import { App, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as backup from 'aws-cdk-lib/aws-backup';
import { IntegTest } from '@aws-cdk/integ-tests-alpha';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

class TestStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    new Table(this, 'Table', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const firstVault = new backup.BackupVault(this, 'FirstVault', {
      removalPolicy: RemovalPolicy.DESTROY,
      lockConfiguration: {
        minRetention: Duration.days(5),
      },
    });

    const secondVault = new backup.BackupVault(this, 'SecondVault', {
      removalPolicy: RemovalPolicy.DESTROY,
      lockConfiguration: {
        minRetention: Duration.days(5),
      },
    });

    const firstPlan = backup.BackupPlan.dailyWeeklyMonthly5YearRetention(this, 'FirstPlan', firstVault);
    const secondPlan = backup.BackupPlan.dailyWeeklyMonthly5YearRetention(this, 'SecondPlan', secondVault);

    firstPlan.addSelection('SelectionWithAutoGeneratedPolicy', {
      resources: [
        backup.BackupResource.fromConstruct(this),
      ],
      allowRestores: true,
    });

    const role = new Role(this, 'BackupRole', {
      assumedBy: new ServicePrincipal('backup.amazonaws.com'),
    });
    role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AWSBackupServiceRolePolicyForS3Backup'));
    role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AWSBackupServiceRolePolicyForS3Restore'));
    secondPlan.addSelection('SelectionWithoutAutoGeneratedPolicy', {
      resources: [
        backup.BackupResource.fromConstruct(this),
      ],
      role,
      disableDefaultBackupPolicy: true,
    });
  }
}

const app = new App();
const stack = new TestStack(app, 'cdk-backup-selection');

new IntegTest(app, 'BackupSelectionTest', {
  testCases: [stack],
});