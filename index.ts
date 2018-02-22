#!/usr/bin/env node

import * as request from 'request-promise';
import * as fs from 'fs';
import * as _ from 'lodash';
import * as args from 'commander';
import * as archiver from 'archiver-promise';

const baseUrl = 'https://build.phonegap.com/api/v1';
const pollTime = 10000;
const zipPath = './www.zip';

args
  .version('0.1')
  .option('-a, --appId <item>', 'Phone gap app id', parseInt)
  .option('-t, --token <item>', 'Phone gap build API auth token')
  .option('-p, --platform <item>', 'Platform')
  .option('-k, --keystorePassword <item>', 'Keystore password')
  .option('-s, --keyPassword <item>', 'Signing key password')
  .parse(process.argv);

async function sleep(duration: number) {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(), duration);
  });
}

async function zip() {
  const fileOutput = fs.createWriteStream(zipPath);
  const archive = archiver('zip', {
    zlib: { level: 9 },
  });
  archive.pipe(fileOutput);
  archive.glob('www/**/*');
  archive.glob('resources/**/*');
  archive.glob('config.xml');
  await archive.finalize();
  console.log('Zipped app for upload');
}

async function build(platform: string) {
  await zip();
  // Get all keys
  const response = await request.get(`${baseUrl}/keys?auth_token=${args.token}`);
  const keyId = _.get(JSON.parse(response), `keys.${platform}.all[0].id`);
  if (!keyId) {
    console.info('No signing key found for this platform');
  } else {
     // Unlock key
    const password = platform === 'ios' ? { password: args.keystorePassword } : { key_pw: args.keyPassword, keystore_pw: args.keystorePassword };
    await request.put(`${baseUrl}/keys/${platform}/${keyId}?auth_token=${args.token}`, { formData: { data: JSON.stringify(password) } });
    console.log('Unlocked key');
  }
  // Submit
  await request.put(`${baseUrl}/apps/${args.appId}?auth_token=${args.token}`, { formData: { file: fs.createReadStream(zipPath) } });
  console.log('Uploaded source code');
  // Start build
  await request.post(`${baseUrl}/apps/${args.appId}/build/${platform}?auth_token=${args.token}`);
  console.log('Started build');
  // Wait / Poll
  let status = 'pending';
  while (status === 'pending') {
    await sleep(pollTime);
    const e = await request.get(`${baseUrl}/apps/${args.appId}?auth_token=${args.token}`);
    const result = JSON.parse(e);
    status = result.status[platform];
    console.log(`Status: ${status}...`);
    if (status === 'error') {
      console.log(`Error: ${result.error[platform]}`);
    }
  }
  // Download
  if (status == 'complete') {
    const outfilename = `watercoolr-${platform}.${platform  === 'ios' ? 'ipa' : 'apk'}`;
    const file = await request.get(`${baseUrl}/apps/${args.appId}/${platform}?auth_token=${args.token}`).pipe(fs.createWriteStream(outfilename));
    console.log(`Downloaded ${outfilename}`);
  }
}

build(args.platform);
