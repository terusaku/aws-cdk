import { Aspects, Stage } from '../../../core';
import { Construct } from 'constructs';
import { AddStageOpts as StageOptions, WaveOptions, Wave, IFileSetProducer, ShellStep, FileSet } from '../blueprint';

const PIPELINE_SYMBOL = Symbol.for('@aws-cdk/pipelines.PipelineBase');

/**
 * Properties for a `Pipeline`
 */
export interface PipelineBaseProps {
  /**
   * The build step that produces the CDK Cloud Assembly
   *
   * The primary output of this step needs to be the `cdk.out` directory
   * generated by the `cdk synth` command.
   *
   * If you use a `ShellStep` here and you don't configure an output directory,
   * the output directory will automatically be assumed to be `cdk.out`.
   */
  readonly synth: IFileSetProducer;
}

/**
 * A generic CDK Pipelines pipeline
 *
 * Different deployment systems will provide subclasses of `Pipeline` that generate
 * the deployment infrastructure necessary to deploy CDK apps, specific to that system.
 *
 * This library comes with the `CodePipeline` class, which uses AWS CodePipeline
 * to deploy CDK apps.
 *
 * The actual pipeline infrastructure is constructed (by invoking the engine)
 * when `buildPipeline()` is called, or when `app.synth()` is called (whichever
 * happens first).
 */
export abstract class PipelineBase extends Construct {
  /**
   * Return whether the given object extends `PipelineBase`.
   *
   * We do attribute detection since we can't reliably use 'instanceof'.
   */
  public static isPipeline(x: any): x is PipelineBase {
    return x !== null && typeof (x) === 'object' && PIPELINE_SYMBOL in x;
  }

  /**
   * The build step that produces the CDK Cloud Assembly
   */
  public readonly synth: IFileSetProducer;

  /**
   * The waves in this pipeline
   */
  public readonly waves: Wave[];

  /**
   * The FileSet tha contains the cloud assembly
   *
   * This is the primary output of the synth step.
   */
  public readonly cloudAssemblyFileSet: FileSet;

  private built = false;

  constructor(scope: Construct, id: string, props: PipelineBaseProps) {
    super(scope, id);

    Object.defineProperty(this, PIPELINE_SYMBOL, { value: true });

    if (props.synth instanceof ShellStep && !props.synth.primaryOutput) {
      props.synth.primaryOutputDirectory('cdk.out');
    }

    if (!props.synth.primaryOutput) {
      throw new Error(`synthStep ${props.synth} must produce a primary output, but is not producing anything. Configure the Step differently or use a different Step type.`);
    }

    this.synth = props.synth;
    this.waves = [];
    this.cloudAssemblyFileSet = props.synth.primaryOutput;

    Aspects.of(this).add({ visit: () => this.buildJustInTime() });
  }

  /**
   * Deploy a single Stage by itself
   *
   * Add a Stage to the pipeline, to be deployed in sequence with other
   * Stages added to the pipeline. All Stacks in the stage will be deployed
   * in an order automatically determined by their relative dependencies.
   */
  public addStage(stage: Stage, options?: StageOptions) {
    if (this.built) {
      throw new Error('addStage: can\'t add Stages anymore after buildPipeline() has been called');
    }
    return this.addWave(stage.stageName).addStage(stage, options);
  }

  /**
   * Add a Wave to the pipeline, for deploying multiple Stages in parallel
   *
   * Use the return object of this method to deploy multiple stages in parallel.
   *
   * Example:
   *
   * ```ts
   * declare const pipeline: pipelines.CodePipeline;
   *
   * const wave = pipeline.addWave('MyWave');
   * wave.addStage(new MyApplicationStage(this, 'Stage1'));
   * wave.addStage(new MyApplicationStage(this, 'Stage2'));
   * ```
   */
  public addWave(id: string, options?: WaveOptions) {
    if (this.built) {
      throw new Error('addWave: can\'t add Waves anymore after buildPipeline() has been called');
    }

    const wave = new Wave(id, options);
    this.waves.push(wave);
    return wave;
  }

  /**
   * Send the current pipeline definition to the engine, and construct the pipeline
   *
   * It is not possible to modify the pipeline after calling this method.
   */
  public buildPipeline() {
    if (this.built) {
      throw new Error('build() has already been called: can only call it once');
    }
    this.doBuildPipeline();
    this.built = true;
  }

  /**
   * Implemented by subclasses to do the actual pipeline construction
   */
  protected abstract doBuildPipeline(): void;

  /**
   * Automatically call 'build()' just before synthesis if the user hasn't explicitly called it yet
   */
  private buildJustInTime() {
    if (!this.built) {
      this.buildPipeline();
    }
  }
}
