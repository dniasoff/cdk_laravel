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
    
    
    constructor(scope: App, id: string, props: GlobalProperties, vpc_cidr: string, hostedZoneId: string) {
        super(scope, id);


        //create vpc
        props.Vpc = new ec2.Vpc(this, `${id}-vpc`, {
            cidr: vpc_cidr,
            maxAzs: 2,
            natGateways: 1,
            enableDnsSupport: true,

        })

        // create security groups

        const bastionSg = new ec2.SecurityGroup(this, `${id}-bastion`, {
            vpc: props.Vpc,
            allowAllOutbound: true,
            description: 'Bastion Security Group'
        });
        bastionSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'SSH frm anywhere');

        props.RdsSg = new ec2.SecurityGroup(this, `${id}-db-cluster`, {
            vpc: props.Vpc,
            allowAllOutbound: true,
            description: 'RDS Security Group'
        });
        props.RdsSg.addIngressRule(ec2.Peer.ipv4(vpc_cidr), ec2.Port.tcp(3306), 'MySql Traffic');

        props.RedisSg = new ec2.SecurityGroup(this, `${id}-redis-cluster`, {
            vpc: props.Vpc,
            allowAllOutbound: true,
            description: 'Redis Security Group'
        });
        props.RedisSg.addIngressRule(ec2.Peer.ipv4(vpc_cidr), ec2.Port.tcp(6379), 'Redis Traffic');

        // create bastion

        const publicSubnets = props.Vpc.selectSubnets({
            subnetType: ec2.SubnetType.PUBLIC,
        });

        const bastion = new ec2.BastionHostLinux(this, "bastion",
            {
                vpc: props.Vpc,
                instanceType: new ec2.InstanceType("t2.nano"),
                securityGroup: bastionSg,
                subnetSelection: publicSubnets,
                machineImage: ec2.MachineImage.latestAmazonLinux()
            }
        )

        props.HostedZone = route53.HostedZone.fromHostedZoneAttributes(this, "zone", {
            zoneName: props.Domain,
            hostedZoneId: hostedZoneId
        });

        props.SslCertificate = new acm.DnsValidatedCertificate(this, 'SiteCertificate', {
            domainName: props.Domain,
            subjectAlternativeNames: [ `*.${props.Domain}`],
            hostedZone: props.HostedZone,
            region: 'us-east-1', // Cloudfront only checks this region for certificates.
        })

       
         
   
        


        cdk.Tags.of(this).add("branch", "shared");


    }

}

export { SharedStack }