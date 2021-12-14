'use strict';

const { CloudFormationClient, DescribeStacksCommand } = require('@aws-sdk/client-cloudformation');
const { spawn } = require('child_process');

class AwsDeployHelper {
  constructor(clientConfig, profile) {
    this.clientConfig = clientConfig;
    this.profile = profile;
  }

  async getDefaultSamCliBucket() {
    const samlCliStackOutputs = await this.getStackOutputs('aws-sam-cli-managed-default');
    return samlCliStackOutputs['SourceBucket'];
  }

  async deploy(samPath, stackName, parameterOverrides) {
    const buildExitCode = await this.run('node',
      [
        '../../node_modules/webpack-cli/bin/cli.js',
      ],
      { cwd: samPath });
    if (buildExitCode !== 0) {
      console.error('Unable to build deployment package');
      return buildExitCode;
    }
    const deployExitCode = await this.run('sam',
      [
        'deploy',
        '--region', this.clientConfig.region,
        '--profile', this.profile,
        '--stack-name', stackName,
        '--resolve-s3',
        '--s3-prefix', stackName,
        '--capabilities', 'CAPABILITY_IAM',
        '--no-fail-on-empty-changeset',
        '--no-confirm-changeset',
        '--parameter-overrides', `${parameterOverrides.join(' ')}`,
      ],
      { cwd: samPath, shell: true }
    );
    if (deployExitCode !== 0) {
      console.error('Deploy failed');
      return deployExitCode;
    }
    return 0;
  }

  onExit(childProcess) {
    return new Promise((resolve, reject) => {
      childProcess.once('exit', (code, signal) => {
        resolve(code);
      });
      childProcess.once('error', (err) => {
        reject(err);
      });
    });
  }

  async run(cmd, args, options) {
    const childProcess = spawn(cmd, args,
      { ...options, stdio: [process.stdin, process.stdout, process.stderr] });

    return await this.onExit(childProcess);
  }

  async getStackOutputs(stackName) {
    const client = new CloudFormationClient(this.clientConfig);
    const describeCommand = new DescribeStacksCommand({ StackName: stackName });
    const stacks = await client.send(describeCommand);
    const outputs = {};
    stacks.Stacks[0].Outputs.forEach(o => outputs[o.OutputKey] = o.OutputValue);
    return outputs;
  }
}

module.exports = AwsDeployHelper;