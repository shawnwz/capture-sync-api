import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { ICaptureSyncApiGatewayStackProps, IValidators } from '../bin/stack-config-types';
import {Duration} from 'aws-cdk-lib';

export class CaptureSyncStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ICaptureSyncApiGatewayStackProps) {
    super(scope, id, props);

    const rabbitMQHost = new cdk.CfnParameter(this, 'RabbitMQHost', {
      type: 'String',
      description: 'The public RabbitMQ host name',
    }).valueAsString;

    const rabbitMQUser = new cdk.CfnParameter(this, 'RabbitMQUser', {
      type: 'String',
      description: 'The public RabbitMQ user name',
    }).valueAsString;

    const rabbitMQPort = new cdk.CfnParameter(this, 'RabbitMQPort', {
      type: 'String',
      description: 'The port number of public RabbitMQ',
    }).valueAsString;

    const rabbitMQPass = new cdk.CfnParameter(this, 'RabbitMQPass', {
      type: 'String',
      description: 'The password of public RabbitMQ',
    }).valueAsString;

    const sourceAccount = new cdk.CfnParameter(this, 'SourceAccountId', {
      type: 'String',
      description: 'AWS Source Account ID',
    }).valueAsString;

    const remoteRoleName = new cdk.CfnParameter(this, 'RemoteRoleName', {
      type: 'String',
      description: 'Remote Alchemy Role name',
    }).valueAsString;

    const auth0Audience = new cdk.CfnParameter(this, 'Auth0Audience', {
      type: 'String',
      description: 'auth0 audience',
    }).valueAsString;

    const auth0Issuer = new cdk.CfnParameter(this, 'Auth0Issuer', {
      type: 'String',
      description: 'auth0 issuer',
    }).valueAsString;

    const auth0JwksUri = new cdk.CfnParameter(this, 'Auth0JwksUri', {
      type: 'String',
      description: 'auth0 jwks uri',
    }).valueAsString;



    const bucket = new cdk.aws_s3.Bucket(this, "cloud-capture-sync-api", {
      //bucketName: "cloud-capture-sync-api",
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    //The lambda function used to verify jwt token
    const authLambda = new lambdaNodejs.NodejsFunction(
      this,
      "SecureApiGatewayCustomAuthorizerAuthLambda",
      {
        runtime: Runtime.NODEJS_18_X,
        handler: "handler",
        entry: "lambdas/custom-auth.js",
        environment: {
          AUDIENCE: auth0Audience,
          TOKEN_ISSUER: auth0Issuer,
          JWKS_URI: auth0JwksUri,
        },
      }
    );

    const captureSyncLambda = new lambdaNodejs.NodejsFunction(this, "CaptureSyncHandler",{
      functionName: props.lambda.name,
      description: props.lambda.desc,
      bundling: {
        commandHooks: {
          afterBundling: (inputDir: string, outputDir: string): string[] => [
            `cp ${inputDir}/lambdas/cert/ca.cert.pem ${outputDir}`,
          ],
          beforeBundling: (inputDir: string, outputDir: string): string[] => [],
          beforeInstall: (inputDir: string, outputDir: string): string[] => [],
        },
      },
      runtime: Runtime.NODEJS_18_X,
      entry: `lambdas/index.ts`,
      handler: 'handler',
      memorySize: props.lambda.memory,
      timeout: cdk.Duration.seconds(props.lambda.timeout),
      environment: {
         BUCKET_NAME: bucket.bucketName,
         RABBITMQ_HOST: rabbitMQHost,
         RABBITMQ_PORT: rabbitMQPort,
         RABBITMQ_USER: rabbitMQUser,
         RABBITMQ_PASS: rabbitMQPass,
         SOURCE_ACCOUNT: sourceAccount,
         REMOTE_ROLE_NAME: remoteRoleName,
         NODE_EXTRA_CA_CERTS: "ca.cert.pem"
       }
    });

    captureSyncLambda.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${sourceAccount}:role/${remoteRoleName}`],
      }),
    );

    bucket.grantReadWrite(captureSyncLambda);

    const api = new apigw.RestApi(this, "capture-sync-api", {
      restApiName: props.api.name,
      description: props.api.desc,
      deployOptions: { stageName: "latest"},
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'PATCH', 'DELETE']
      },
      binaryMediaTypes: ['*/*'],
    });

    const createValidator = (input: IValidators) => new apigw.RequestValidator(
      this,
      input.requestValidatorName,
      {
        restApi: api,
        requestValidatorName: input.requestValidatorName,
        validateRequestBody: input.validateRequestBody,
        validateRequestParameters: input.validateRequestParameters,
      },
    );

    //gateway authorizer
    // const authorizer = new apigw.TokenAuthorizer(this, "auth0Authorizer", {
    //   handler: authLambda,
    //   identitySource : apigw.IdentitySource.header("Authorization"),
    //   resultsCacheTtl: Duration.seconds(0),
    // });


    const bodyValidator = createValidator(props.validators.bodyValidator);
    const paramValidator = createValidator(props.validators.paramValidator);
    const bodyAndParamValidator = createValidator(props.validators.bodyAndParamValidator);

    const requestBodySchema = new apigw.Model(this, 'RequestBodySchema', {
      modelName: props.api.modelName,
      restApi: api,
      schema: {
        type: apigw.JsonSchemaType.OBJECT,
        properties: {
          name: { type: apigw.JsonSchemaType.STRING },
        },
        required: ['name'],
      },
    })

    api.root.resourceForPath("sync").addMethod("POST", new apigw.LambdaIntegration(captureSyncLambda), {
      operationName: 'post captured content',
      apiKeyRequired: false,
      //authorizer: authorizer,
      //authorizationType: apigw.AuthorizationType.CUSTOM,
      //requestValidator: bodyValidator,
      //requestModels: {'multipart/form-data': model},
    });

    api.root.resourceForPath("sync/file-manager/upload").addMethod("POST", new apigw.LambdaIntegration(captureSyncLambda), {
      operationName: 'post captured content',
      apiKeyRequired: false,
      //authorizer: authorizer,
      //authorizationType: apigw.AuthorizationType.CUSTOM,
      //requestValidator: bodyValidator,
      //requestModels: {'multipart/form-data': model},
    });

    new cdk.CfnOutput(this, "Lambda Function ARN", {value: captureSyncLambda.functionArn})
    new cdk.CfnOutput(this, "API URL", {value: api.url ?? "something wrong!!!"})

  }
}
