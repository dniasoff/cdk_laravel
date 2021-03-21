
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';


import { DistinctResources } from './distinct_resources';
import { CommonResources } from './common_resources';
import { GlobalProperties } from './global_properties';

class SharedServices extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props: cdk.StackProps, globalProps: GlobalProperties,) {
      super(scope, id, props);
  
      new CommonResources(scope, `${globalProps.serviceName}ResourcesCommon`, props, globalProps);
  
      new DistinctResources(scope, `${globalProps.serviceName}ResourcesProduction`, props, globalProps, true);
      new DistinctResources(scope, `${globalProps.serviceName}ResourcesNonProduction`, props, globalProps, false);
    
    }
  }

  export { SharedServices }