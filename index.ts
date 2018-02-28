#!/usr/bin/env node

import * as archiver from 'archiver'
import * as args from 'commander'
import * as fs from 'fs'
import * as _ from 'lodash'
import * as request from 'request-promise'
import * as stp from 'stream-to-promise'

const baseUrl = 'https://build.phonegap.com/api/v1'
const pollTime = 10000

args
  .version('0.1')
  .option('-a, --appId <item>', 'Phone gap app id', parseInt)
  .option('-t, --token <item>', 'Phone gap build API auth token')
  .option('-p, --platform <item>', 'Platform')
  .option('-i, --keyId <item>', 'Key id')
  .option('-k, --keystorePassword <item>', 'Keystore password')
  .option('-s, --keyPassword <item>', 'Signing key password')
  .parse(process.argv)

// Load from environments if needed
if (!args.appId) { args.appId = process.env.PHONEGAP_APP_ID }
if (!args.token) { args.token = process.env.PHONEGAP_AUTH_TOKEN }
if (!args.keystorePassword) { args.keystorePassword = process.env.PHONEGAP_KEYSTORE_PASSWORD }
if (!args.keyPassword) { args.keyPassword = process.env.PHONEGAP_KEY_PASSWORD }
if (!args.keyId) { args.keyId = process.env.PHONEGAP_KEY_ID }

async function sleep(duration: number) {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(), duration)
  })
}

function zip(): Promise<Buffer> {
  const archive = archiver('zip', {
    zlib: { level: 9 },
  })
  archive.glob('www/**/*')
  archive.glob('resources/**/*')
  archive.glob('config.xml')
  archive.finalize()
  console.log('Zipped app for upload.')
  return stp(archive)
}

async function build(platform: string) {
  const zippedApp = await zip()
  // Get all keys
  if (!args.keyId) {
    const response = await request.get(`${baseUrl}/keys?auth_token=${args.token}`)
    args.keyId = _.get(JSON.parse(response), `keys.${platform}.all[0].id`)
    if (!args.keyId) {
      console.info('No signing key found for this platform')
    }
  }

  if (args.keyId) {
    // Unlock key
    const password = platform === 'ios' ? { password: args.keystorePassword } : { key_pw: args.keyPassword, keystore_pw: args.keystorePassword }
    await request.put(`${baseUrl}/keys/${platform}/${args.keyId}?auth_token=${args.token}`, { formData: { data: JSON.stringify(password) } })
    console.log('Unlocked key')
  }
  // Submit
  const keys = {}
  keys[platform] = { id: args.keyId }
  const res = await request.put(`${baseUrl}/apps/${args.appId}?auth_token=${args.token}`, {
    formData: {
      file: {
        value: zippedApp,
        options: {
          filename: 'www.zip',
          contentType: 'application/zip',
        },
      },
      data: {
        keys: {
          value: keys,
          options: {
            contentType: 'application/json',
          },
        },
      },
    },
  })
  const appTitle = JSON.parse(res).title
  console.log(`Uploaded source code, new version ${JSON.parse(res).version}`)
  // Start build
  await request.post(`${baseUrl}/apps/${args.appId}/build/${platform}?auth_token=${args.token}`)
  console.log('Started build')
  // Wait / Poll
  let status = 'pending'
  while (status === 'pending') {
    await sleep(pollTime)
    const e = await request.get(`${baseUrl}/apps/${args.appId}?auth_token=${args.token}`)
    const result = JSON.parse(e)
    status = result.status[platform]
    console.log(`Status: ${status}...`)
    if (status === 'error') {
      console.log(`Error: ${result.error[platform]}`)
    }
  }
  // Download
  if (status === 'complete') {
    const outfilename = `${appTitle ? appTitle : 'app'}-${platform}.${platform  === 'ios' ? 'ipa' : 'apk'}`
    const file = await request.get(`${baseUrl}/apps/${args.appId}/${platform}?auth_token=${args.token}`).pipe(fs.createWriteStream(outfilename))
    console.log(`Downloaded ${outfilename}`)
  }
}

build(args.platform)
