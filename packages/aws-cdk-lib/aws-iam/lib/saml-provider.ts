import * as fs from 'fs';
import { IResource, Resource, Token } from '../../core';
import { Construct } from 'constructs';
import { CfnSAMLProvider } from './iam.generated';

/**
 * A SAML provider
 */
export interface ISamlProvider extends IResource {
  /**
   * The Amazon Resource Name (ARN) of the provider
   *
   * @attribute
   */
  readonly samlProviderArn: string;
}

/**
 * Properties for a SAML provider
 */
export interface SamlProviderProps {
  /**
   * The name of the provider to create.
   *
   * This parameter allows a string of characters consisting of upper and
   * lowercase alphanumeric characters with no spaces. You can also include
   * any of the following characters: _+=,.@-
   *
   * Length must be between 1 and 128 characters.
   *
   * @default - a CloudFormation generated name
   */
  readonly name?: string;

  /**
   * An XML document generated by an identity provider (IdP) that supports
   * SAML 2.0. The document includes the issuer's name, expiration information,
   * and keys that can be used to validate the SAML authentication response
   * (assertions) that are received from the IdP. You must generate the metadata
   * document using the identity management software that is used as your
   * organization's IdP.
   */
  readonly metadataDocument: SamlMetadataDocument;
}

/**
 * A SAML metadata document
 */
export abstract class SamlMetadataDocument {
  /**
   * Create a SAML metadata document from a XML string
   */
  public static fromXml(xml: string): SamlMetadataDocument {
    return { xml };
  }

  /**
   * Create a SAML metadata document from a XML file
   */
  public static fromFile(path: string): SamlMetadataDocument {
    return { xml: fs.readFileSync(path, 'utf-8') };
  }

  /**
   * The XML content of the metadata document
   */
  public abstract readonly xml: string;
}

/**
 * A SAML provider
 */
export class SamlProvider extends Resource implements ISamlProvider {
  /**
   * Import an existing provider
   */
  public static fromSamlProviderArn(scope: Construct, id: string, samlProviderArn: string): ISamlProvider {
    class Import extends Resource implements ISamlProvider {
      public readonly samlProviderArn = samlProviderArn;
    }
    return new Import(scope, id);
  }

  public readonly samlProviderArn: string;

  constructor(scope: Construct, id: string, props: SamlProviderProps) {
    super(scope, id);

    if (props.name && !Token.isUnresolved(props.name) && !/^[\w+=,.@-]{1,128}$/.test(props.name)) {
      throw new Error('Invalid SAML provider name. The name must be a string of characters consisting of upper and lowercase alphanumeric characters with no spaces. You can also include any of the following characters: _+=,.@-. Length must be between 1 and 128 characters.');
    }

    const samlProvider = new CfnSAMLProvider(this, 'Resource', {
      name: props.name,
      samlMetadataDocument: props.metadataDocument.xml,
    });

    this.samlProviderArn = samlProvider.ref;
  }
}
