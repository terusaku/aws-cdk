import * as fs from 'fs';
import * as path from 'path';
import { initializeProject, availableInitTemplates } from '../../lib/init';
import { warning } from '../logging';

// replace this string with the path to your own noctilucent pkg
import * as nocti from '/Users/bobertzh/work/noctilucent/noctilucent/pkg/noctilucent';

export async function cliMigrate(
  inputpath: string = process.cwd() + '/../temp.txt',
  language?: string,
  generateOnly = false,
  outputpath = process.cwd(),
) {
  const type = 'default'; // "default" is the default type (and maps to 'app')
  const template = (await availableInitTemplates()).find(t => t.hasName(type!));
  if (!template) {
    throw new Error(`couldn't find template for ${type} app type, this should never happen`);
  }

  if (!language) {
    language = 'typescript';
    warning(`No --language was provided, defaulting to --language=${language}`);
  }

  await initializeProject(template, language, true, generateOnly, outputpath);
  const template_file = fs.readFileSync(inputpath, 'utf8');
  const generated_app = nocti.transmute(template_file, language);

  // clear out the init'd bin/lib files to replace with our own
  delete_files(outputpath + '/lib/');

  // we hardcode everything to be called noctstack still so this works for now. 
  // Will change this to be much smarter once we can change stack name in noct
  const bin_app = `#!/usr/bin/env node
  import 'source-map-support/register';
  import * as cdk from 'aws-cdk-lib';
  import { NoctStack } from '../lib/generated_stack';
  
  const app = new cdk.App();
  new NoctStack(app, 'NoctStack', {
    /* If you don't specify 'env', this stack will be environment-agnostic.
     * Account/Region-dependent features and context lookups will not work,
     * but a single synthesized template can be deployed anywhere. */
  
    /* Uncomment the next line to specialize this stack for the AWS Account
     * and Region that are implied by the current CLI configuration. */
    // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  
    /* Uncomment the next line if you know exactly what Account and Region you
     * want to deploy the stack to. */
    // env: { account: '123456789012', region: 'us-east-1' },
  
    /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
  });`;
  const myname = path.basename(outputpath);
  warning(`path name = ${myname}`)
  fs.writeFileSync(outputpath + '/lib/' + 'generated_stack.ts', generated_app);
  fs.writeFileSync(outputpath + '/bin/' + `${myname}.ts`, bin_app);
}

function delete_files(filepath: string) {
  fs.readdir(filepath, (err, files) => {
    if (err) throw err;
    for (const file of files) {
      fs.unlink(filepath + file, (err) => {
        if (err) throw err;
      });
    }
  });
}