# Welcome to my first CDK TypeScript project!

This project was created to help me learn about [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/home.html) , it's benefits over traditional YAML or JSON type IaaC such as CloudFormation and Terraform and understand how it can function as part of a complete DevOps pipeline.

To achieve this I created an imaginary use case of a sample Laravel project and created a complete DevOps pipeline including develop/staging/master branches.

This project is hosted over [here](https://github.com/dniasoff/Laravel-Appointments) and any changes made to that repo should update the relevant environment.

The project was forked from [Laravel-Appointments](https://github.com/LaravelDaily/Laravel-Appointments), docker configuration was added, some customisation was added to make it play nicely with ECS and then a github actions workflow was created which creates docker images for both Laravel and NGINX, upload those images to ECR and then triggers a deployment workflow 

A deployment of Laravel in this example consists of the following AWS Resources

 - VPC
 - Bastion Host
 - RDS Serverless MySql Instance
 - ElastiCache Redis Cluster
 - s3 Bucket to host static content
 - Cloudfront distribution to serve the s3 bucket
 - ECS Fargate Cluster
 - ECS Task Definition for the Laravel and NGINX Containers
 - Application Load Balancer 
 - and many other supporting components such as roles and security groups

In order to emulate a real life use case, I chose to divide the resources into 3 main sections and the diagram below should help explain it

![environment structure](https://raw.githubusercontent.com/dniasoff/cdk_laravel/master/media/cdk_structure.png)

So for starters, there are 3 environments - develop, staging and production a.k.a. master.
There are common resources that are used by all environments and then there are shared resources that might be used by multiple environments. Creating a seperate develop and staging RDS/Cache instances was deemed expensive and unnecessary so both staging and develop share a single non-production instance. Finally there are resources that are unique to each service such as s3 buckets and ECS clusters/tasks.

The CDK file structure has been modelled to reflect the above real life structure.

The main code is contained in lib directory in 4 typescript files. The entrypoint is bin/cdk_laravel.ts

To deploy this code you will need the following 

- AWS credentials configured in your environment
- A recent version of node and npm installed

Then you will need to checkout this repo, edit the settings.json to match your requirements and then run the following commands

```bash
sudo npm install -g typescript # globally installs typescript
sudo npm install -g aws-cdk # globally installs the CDK tools
npm install

cdk synth --all # - creates the cloud formation templates (stored in cdk.out dir)
cdk diff ${STACK_TO_DEPLOY} - shows differences
cdk deploy ${STACK_TO_DEPLOY} - uploads stack to cloudformation and triggers a deploy/update
```

${STACK_TO_DEPLOY} is made up of the following - "${SERVICE_NAME}Service${SERVICE_INSTANCE}" 

${SERVICE_NAME} is stored in settings.json

${SERVICE_INSTANCE} and this should be the branch you are deploying (currently hard coded to master/develop/staging)

You can look at the github actions files to see the deployment workflow. There are a number of different actions 

 1. CDK workflow - this is triggered whenever code is pushed to a branch
 2. Deploy workflow -  this is a [`workflow_dispatch`](https://docs.github.com/en/webhooks/event-payloads/#workflow_dispatch) event triggered manually whenever you want to deploy the infrastructure (branch specific)
 3. Destroy workflow -  this is a [`workflow_dispatch`](https://docs.github.com/en/webhooks/event-payloads/#workflow_dispatch) event triggered manually whenever you want to destroy the infrastructure (branch specific)
 4. Destroy All workflow -  this is a [`workflow_dispatch`](https://docs.github.com/en/webhooks/event-payloads/#workflow_dispatch) event triggered manually whenever you want to destroy all instances of the infrastructure
 5. ECR Container update - this is a [`repository_dispatch`](https://docs.github.com/en/webhooks/event-payloads/#repository_dispatch) event triggered by by a webhook whenever the original laravel container code is updated and tells ECS to use the new container images.

There are around 400 lines of code and all 3 stacks (production/develop/staging) creates around 200 resources - make of that what you will :) These resources can easily be viewed in the AWS CloudFormation console

To destroy the environment run;

```
cdk deploy {STACK_TO_DELETE}

# or

cdk deploy --all
```


