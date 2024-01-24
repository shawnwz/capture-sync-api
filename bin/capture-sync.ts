#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CaptureSyncStack } from '../lib/capture-sync-stack';
import environmentConfig from './stack-config';

const app = new cdk.App();
new CaptureSyncStack(app, 'CaptureSyncStack', environmentConfig);
