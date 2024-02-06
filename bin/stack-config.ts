import { ICaptureSyncApiGatewayStackProps } from './stack-config-types';

const environmentConfig: ICaptureSyncApiGatewayStackProps = {
  tags: {
    Developer: 'mm',
    Application: 'CaptureSyncApiGateway',
  },
  lambda: {
    name: 'CaptureSyncApi',
    desc: 'Lambda func used for receive onsite captures then sync back to WFS onsite',
    memory: 1024,
    timeout: 300,
  },
  api: {
    name: 'capture-sync-rest-api',
    desc: 'Rest Api Gateway for capture sync',
    modelName: 'CaptureSyncModel',
    rootResource: 'v1',
  },
//   usageplan: {
//     name: 'capture-aync-usage-plan',
//     desc: 'Usage plan used for capture sync',
//     limit: 1000000, // per day
//     rateLimit: 20,
//     burstLimit: 10,
//   },
//   apiKey: {
//     name: 'capture-aync-api-key',
//     desc: 'Api Key used for capture sync',
//   },
  validators: {
    bodyValidator: {
        requestValidatorName: 'capture-sync-body-validator',
        validateRequestBody: true,
        validateRequestParameters: false,
    },
    paramValidator: {
        requestValidatorName: 'capture-sync-param-validator',
        validateRequestBody: false,
        validateRequestParameters: true,
    },
    bodyAndParamValidator: {
        requestValidatorName: 'capture-sync-body-and-param-validator',
        validateRequestBody: true,
        validateRequestParameters: true,
    },
  }
};

export default environmentConfig;
