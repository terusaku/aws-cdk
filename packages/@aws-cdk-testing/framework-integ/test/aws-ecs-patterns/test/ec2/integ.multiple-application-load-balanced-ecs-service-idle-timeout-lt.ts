import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { InstanceType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster, ContainerImage } from 'aws-cdk-lib/aws-ecs';
import { ApplicationProtocol, SslPolicy } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { PublicHostedZone } from 'aws-cdk-lib/aws-route53';
import { App, Duration, Stack } from 'aws-cdk-lib';
import * as integ from '@aws-cdk/integ-tests-alpha';
import { ApplicationMultipleTargetGroupsEc2Service } from 'aws-cdk-lib/aws-ecs-patterns';

const app = new App();
const stack = new Stack(app, 'aws-ecs-integ-alb-idle-timeout');
const vpc = new Vpc(stack, 'Vpc', { maxAzs: 2, restrictDefaultSecurityGroup: false });
const zone = new PublicHostedZone(stack, 'HostedZone', { zoneName: 'domain.com' });
const cluster = new Cluster(stack, 'Cluster', { vpc });
cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new InstanceType('t2.micro') });

const cert1 = new Certificate(stack, 'cert1', {
  domainName: 'cert1.domain.com',
});
const cert2 = new Certificate(stack, 'cert2', {
  domainName: 'cert2.domain.com',
});

// Two load balancers with different idle timeouts.
new ApplicationMultipleTargetGroupsEc2Service(stack, 'myService', {
  cluster,
  memoryLimitMiB: 256,
  taskImageOptions: {
    image: ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
  },
  enableExecuteCommand: true,
  loadBalancers: [
    {
      name: 'lb',
      idleTimeout: Duration.seconds(400),
      domainName: 'api.domain.com',
      domainZone: zone,
      listeners: [
        {
          name: 'listener',
          protocol: ApplicationProtocol.HTTPS,
          certificate: cert1,
          sslPolicy: SslPolicy.TLS12_EXT,
        },
      ],
    },
    {
      name: 'lb2',
      idleTimeout: Duration.seconds(400),
      domainName: 'frontend.domain.com',
      domainZone: zone,
      listeners: [
        {
          name: 'listener2',
          protocol: ApplicationProtocol.HTTPS,
          certificate: cert2,
          sslPolicy: SslPolicy.TLS12_EXT,
        },
      ],
    },
  ],
  targetGroups: [
    {
      containerPort: 80,
      listener: 'listener',
    },
    {
      containerPort: 90,
      pathPattern: 'a/b/c',
      priority: 10,
      listener: 'listener',
    },
    {
      containerPort: 443,
      listener: 'listener2',
    },
    {
      containerPort: 80,
      pathPattern: 'a/b/c',
      priority: 10,
      listener: 'listener2',
    },
  ],
});

new integ.IntegTest(app, 'multiAlbEcsEc2Test', {
  testCases: [stack],
});

app.synth();