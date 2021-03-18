#!/usr/bin/env node
import "source-map-support/register"
import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import { App, Stack } from "@aws-cdk/core";
import route53 = require('@aws-cdk/aws-route53');
import acm = require('@aws-cdk/aws-certificatemanager')
import iam = require("@aws-cdk/aws-iam");
import { GlobalProperties } from "./shared_classes";


class SharedStack extends Stack {
    
    
    constructor(scope: App, id: string, props: cdk.StackProps, globalProps: GlobalProperties) {
        super(scope, id, props);


        //create vpc
        globalProps.vpc  = new ec2.Vpc(this, `${id}-vpc`, {
            cidr: globalProps.vpcCidr,
            maxAzs: 2,
            natGateways: 1,
            enableDnsSupport: true,

        })

        // create security groups

        const bastionSg = new ec2.SecurityGroup(this, `${id}-bastion`, {
            vpc: globalProps.vpc ,
            allowAllOutbound: true,
            description: 'Bastion Security Group'
        });
        bastionSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'SSH frm anywhere');

        globalProps.rdsSg = new ec2.SecurityGroup(this, `${id}-db-cluster`, {
            vpc: globalProps.vpc ,
            allowAllOutbound: true,
            description: 'RDS Security Group'
        });
        globalProps.rdsSg.addIngressRule(ec2.Peer.ipv4(globalProps.vpcCidr), ec2.Port.tcp(3306), 'MySql Traffic');

        globalProps.redisSg = new ec2.SecurityGroup(this, `${id}-redis-cluster`, {
            vpc: globalProps.vpc ,
            allowAllOutbound: true,
            description: 'Redis Security Group'
        });
        globalProps.redisSg.addIngressRule(ec2.Peer.ipv4(globalProps.vpcCidr), ec2.Port.tcp(6379), 'Redis Traffic');

        // create bastion

        const publicSubnets = globalProps.vpc .selectSubnets({
            subnetType: ec2.SubnetType.PUBLIC,
        });

        const bastion = new ec2.BastionHostLinux(this, "bastion",
            {
                vpc: globalProps.vpc ,
                instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
                securityGroup: bastionSg,
                subnetSelection: publicSubnets,
                machineImage: ec2.MachineImage.latestAmazonLinux()
            }
        )

        globalProps.hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, "zone", {
            zoneName: globalProps.domain,
            hostedZoneId: globalProps.hostedZoneId
        });

        globalProps.sslCertificate = new acm.DnsValidatedCertificate(this, 'SiteCertificate', {
            domainName: globalProps.domain,
            subjectAlternativeNames: [ `*.${globalProps.domain}`],
            hostedZone: globalProps.hostedZone,
            region: 'us-east-1', // Cloudfront only checks this region for certificates.
        })

        cdk.Tags.of(this).add("branch", "shared");


    }

}

export { SharedStack }