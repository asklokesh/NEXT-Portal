import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as gcp from '@pulumi/gcp';
import * as azure from '@pulumi/azure-native';
import * as cloudflare from '@pulumi/cloudflare';

export interface CDNStackArgs {
  provider: any;
  environment: string;
  originDomain: pulumi.Output<string>;
  s3Bucket: any;
  enableWAF: boolean;
  enableDDoSProtection: boolean;
  priceClass: string;
  certificateArn?: pulumi.Output<string>;
  customDomain?: string;
  geoRestriction: {
    restrictionType: 'whitelist' | 'blacklist' | 'none';
    locations: string[];
  };
  cacheBehaviors: Array<{
    pathPattern: string;
    targetOriginId: string;
    viewerProtocolPolicy: string;
    allowedMethods: string[];
    cachedMethods: string[];
    compress: boolean;
    defaultTTL: number;
    maxTTL: number;
    minTTL: number;
  }>;
}

export class CDNStack extends pulumi.ComponentResource {
  public readonly distribution: any;
  public readonly domainName: pulumi.Output<string>;
  public readonly resourceCount: pulumi.Output<number>;

  constructor(name: string, args: CDNStackArgs, opts?: pulumi.ComponentResourceOptions) {
    super('saas-idp:cdn:Stack', name, {}, opts);

    const defaultTags = {
      Environment: args.environment,
      ManagedBy: 'Pulumi',
      Component: 'CDN',
      Project: 'SaaS-IDP'
    };

    if (args.provider.constructor.name.includes('Aws')) {
      // AWS CloudFront Implementation
      
      // Create Origin Access Identity for S3
      const oai = new aws.cloudfront.OriginAccessIdentity(`${name}-oai`, {
        comment: `OAI for ${name} CDN`
      }, { parent: this });

      // Update S3 bucket policy to allow CloudFront access
      const bucketPolicy = new aws.s3.BucketPolicy(`${name}-cdn-bucket-policy`, {
        bucket: args.s3Bucket.id,
        policy: pulumi.all([args.s3Bucket.arn, oai.iamArn]).apply(([bucketArn, oaiArn]) => JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'AllowCloudFrontOAI',
              Effect: 'Allow',
              Principal: {
                AWS: oaiArn
              },
              Action: 's3:GetObject',
              Resource: `${bucketArn}/*`
            }
          ]
        }))
      }, { parent: this });

      // Create CloudFront distribution
      this.distribution = new aws.cloudfront.Distribution(`${name}-distribution`, {
        enabled: true,
        isIpv6Enabled: true,
        comment: `CDN for ${name}`,
        defaultRootObject: 'index.html',
        priceClass: args.priceClass,
        aliases: args.customDomain ? [args.customDomain] : [],
        viewerCertificate: args.certificateArn ? {
          acmCertificateArn: args.certificateArn,
          sslSupportMethod: 'sni-only',
          minimumProtocolVersion: 'TLSv1.2_2021'
        } : {
          cloudfrontDefaultCertificate: true
        },
        
        // Origins
        origins: [
          {
            originId: 'api',
            domainName: args.originDomain,
            customOriginConfig: {
              httpPort: 80,
              httpsPort: 443,
              originProtocolPolicy: 'https-only',
              originSslProtocols: ['TLSv1.2'],
              originReadTimeout: 60,
              originKeepaliveTimeout: 5
            },
            customHeaders: [
              {
                name: 'X-CDN-Origin',
                value: 'cloudfront'
              }
            ]
          },
          {
            originId: 's3',
            domainName: args.s3Bucket.bucketRegionalDomainName,
            s3OriginConfig: {
              originAccessIdentity: oai.cloudfrontAccessIdentityPath
            }
          }
        ],
        
        // Default cache behavior
        defaultCacheBehavior: {
          targetOriginId: 'api',
          viewerProtocolPolicy: 'redirect-to-https',
          allowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
          cachedMethods: ['GET', 'HEAD', 'OPTIONS'],
          compress: true,
          defaultTtl: 0,
          maxTtl: 31536000,
          minTtl: 0,
          forwardedValues: {
            queryString: true,
            headers: ['Authorization', 'CloudFront-Forwarded-Proto', 'CloudFront-Is-Desktop-Viewer', 
                     'CloudFront-Is-Mobile-Viewer', 'CloudFront-Is-Tablet-Viewer', 'Host'],
            cookies: {
              forward: 'all'
            }
          },
          functionAssociations: args.environment === 'production' ? [
            {
              eventType: 'viewer-request',
              functionArn: this.createCloudfrontFunction(`${name}-security-headers`, this.getSecurityHeadersFunction()).arn
            }
          ] : []
        },
        
        // Ordered cache behaviors
        orderedCacheBehaviors: args.cacheBehaviors.map((behavior, index) => ({
          pathPattern: behavior.pathPattern,
          targetOriginId: behavior.targetOriginId,
          viewerProtocolPolicy: behavior.viewerProtocolPolicy,
          allowedMethods: behavior.allowedMethods,
          cachedMethods: behavior.cachedMethods,
          compress: behavior.compress,
          defaultTtl: behavior.defaultTTL,
          maxTtl: behavior.maxTTL,
          minTtl: behavior.minTTL,
          forwardedValues: {
            queryString: true,
            headers: behavior.targetOriginId === 'api' 
              ? ['Authorization', 'Host', 'Accept', 'Accept-Language', 'Content-Type']
              : [],
            cookies: {
              forward: behavior.targetOriginId === 'api' ? 'all' : 'none'
            }
          },
          cachePolicyId: behavior.targetOriginId === 's3' 
            ? '658327ea-f89d-4fab-a63d-7e88639e58f6' // Managed-CachingOptimized
            : '4135ea2d-6df8-44a3-9df3-4b5a84be39ad', // Managed-CachingDisabled
          originRequestPolicyId: behavior.targetOriginId === 'api'
            ? '88a5eaf4-2fd4-4709-b370-b4c650ea3fcf' // Managed-CORS-S3Origin
            : undefined
        })),
        
        // Custom error responses
        customErrorResponses: [
          {
            errorCode: 403,
            responseCode: 200,
            responsePagePath: '/index.html',
            errorCachingMinTtl: 300
          },
          {
            errorCode: 404,
            responseCode: 200,
            responsePagePath: '/index.html',
            errorCachingMinTtl: 300
          },
          {
            errorCode: 500,
            responseCode: 500,
            responsePagePath: '/error.html',
            errorCachingMinTtl: 60
          },
          {
            errorCode: 502,
            responseCode: 502,
            responsePagePath: '/error.html',
            errorCachingMinTtl: 60
          },
          {
            errorCode: 503,
            responseCode: 503,
            responsePagePath: '/maintenance.html',
            errorCachingMinTtl: 0
          }
        ],
        
        // Geo restrictions
        restrictions: {
          geoRestriction: args.geoRestriction
        },
        
        // WAF integration
        webAclId: args.enableWAF ? pulumi.output(args.provider.wafArn) : undefined,
        
        // Logging
        loggingConfig: args.environment === 'production' ? {
          bucket: pulumi.interpolate`${name}-cdn-logs.s3.amazonaws.com`,
          prefix: 'cloudfront/',
          includeCookies: false
        } : undefined,
        
        // HTTP/2 and HTTP/3 support
        httpVersion: 'http2and3',
        
        tags: {
          ...defaultTags,
          Name: `${name}-cdn`
        }
      }, { parent: this, dependsOn: [bucketPolicy] });

      // Create Route53 record if custom domain is provided
      if (args.customDomain) {
        const zone = aws.route53.getZone({
          name: args.customDomain.split('.').slice(-2).join('.')
        });

        new aws.route53.Record(`${name}-cdn-dns`, {
          zoneId: zone.then(z => z.zoneId),
          name: args.customDomain,
          type: 'A',
          aliases: [{
            name: this.distribution.domainName,
            zoneId: this.distribution.hostedZoneId,
            evaluateTargetHealth: false
          }]
        }, { parent: this });

        new aws.route53.Record(`${name}-cdn-dns-aaaa`, {
          zoneId: zone.then(z => z.zoneId),
          name: args.customDomain,
          type: 'AAAA',
          aliases: [{
            name: this.distribution.domainName,
            zoneId: this.distribution.hostedZoneId,
            evaluateTargetHealth: false
          }]
        }, { parent: this });
      }

      // Create CloudWatch alarms for CDN monitoring
      const cdnAlarms = [
        {
          name: 'high-4xx-errors',
          metricName: '4xxErrorRate',
          threshold: 5,
          description: 'High 4xx error rate'
        },
        {
          name: 'high-5xx-errors',
          metricName: '5xxErrorRate',
          threshold: 1,
          description: 'High 5xx error rate'
        },
        {
          name: 'high-origin-latency',
          metricName: 'OriginLatency',
          threshold: 1000,
          description: 'High origin latency'
        }
      ];

      cdnAlarms.forEach(alarm => {
        new aws.cloudwatch.MetricAlarm(`${name}-cdn-alarm-${alarm.name}`, {
          alarmName: `${name}-cdn-${alarm.name}`,
          comparisonOperator: 'GreaterThanThreshold',
          evaluationPeriods: 2,
          metricName: alarm.metricName,
          namespace: 'AWS/CloudFront',
          period: 300,
          statistic: 'Average',
          threshold: alarm.threshold,
          alarmDescription: alarm.description,
          dimensions: {
            DistributionId: this.distribution.id
          },
          tags: defaultTags
        }, { parent: this });
      });

      this.domainName = args.customDomain 
        ? pulumi.output(args.customDomain)
        : this.distribution.domainName;
      
      this.resourceCount = pulumi.output(
        1 + // Distribution
        1 + // OAI
        1 + // Bucket Policy
        (args.customDomain ? 2 : 0) + // Route53 records
        cdnAlarms.length + // CloudWatch alarms
        (args.environment === 'production' ? 1 : 0) // CloudFront function
      );

    } else if (args.provider.constructor.name.includes('Gcp')) {
      // GCP Cloud CDN Implementation
      const backendBucket = new gcp.compute.BackendBucket(`${name}-backend-bucket`, {
        bucketName: args.s3Bucket.name,
        enableCdn: true,
        cdnPolicy: {
          cacheMode: 'CACHE_ALL_STATIC',
          defaultTtl: 3600,
          maxTtl: 86400,
          negativeCaching: true,
          serveWhileStale: 86400
        },
        project: args.provider.project
      }, { parent: this });

      const urlMap = new gcp.compute.UrlMap(`${name}-url-map`, {
        defaultService: backendBucket.id,
        hostRules: [
          {
            hosts: [args.customDomain || '*'],
            pathMatcher: 'allpaths'
          }
        ],
        pathMatchers: [
          {
            name: 'allpaths',
            defaultService: backendBucket.id,
            pathRules: args.cacheBehaviors.map(behavior => ({
              paths: [behavior.pathPattern],
              service: backendBucket.id
            }))
          }
        ],
        project: args.provider.project
      }, { parent: this });

      const httpsProxy = new gcp.compute.TargetHttpsProxy(`${name}-https-proxy`, {
        urlMap: urlMap.id,
        sslCertificates: args.certificateArn ? [args.certificateArn] : [],
        project: args.provider.project
      }, { parent: this });

      const globalAddress = new gcp.compute.GlobalAddress(`${name}-ip`, {
        project: args.provider.project
      }, { parent: this });

      this.distribution = new gcp.compute.GlobalForwardingRule(`${name}-forwarding-rule`, {
        target: httpsProxy.id,
        portRange: '443',
        ipAddress: globalAddress.address,
        project: args.provider.project
      }, { parent: this });

      this.domainName = globalAddress.address;
      this.resourceCount = pulumi.output(5);

    } else if (args.provider.constructor.name.includes('Azure')) {
      // Azure CDN Implementation
      const resourceGroup = new azure.resources.ResourceGroup(`${name}-rg`, {
        location: args.provider.location,
        tags: defaultTags
      }, { parent: this });

      const profile = new azure.cdn.Profile(`${name}-cdn-profile`, {
        resourceGroupName: resourceGroup.name,
        location: 'Global',
        sku: {
          name: args.environment === 'production' ? 'Standard_Microsoft' : 'Standard_Akamai'
        },
        tags: defaultTags
      }, { parent: this });

      const endpoint = new azure.cdn.Endpoint(`${name}-cdn-endpoint`, {
        resourceGroupName: resourceGroup.name,
        profileName: profile.name,
        location: 'Global',
        origins: [{
          name: 'origin',
          hostName: args.originDomain.apply(d => d)
        }],
        isHttpAllowed: false,
        isHttpsAllowed: true,
        contentTypesToCompress: [
          'text/html',
          'text/css',
          'text/javascript',
          'application/javascript',
          'application/json',
          'application/xml'
        ],
        isCompressionEnabled: true,
        tags: defaultTags
      }, { parent: this });

      this.distribution = endpoint;
      this.domainName = endpoint.hostName;
      this.resourceCount = pulumi.output(3);
    }

    // Use Cloudflare for additional CDN capabilities
    if (args.environment === 'production' && args.customDomain) {
      const cloudflareZone = cloudflare.getZone({
        name: args.customDomain.split('.').slice(-2).join('.')
      });

      // Create Cloudflare proxy record
      new cloudflare.Record(`${name}-cf-record`, {
        zoneId: cloudflareZone.then(z => z.id),
        name: args.customDomain.split('.')[0],
        type: 'CNAME',
        value: this.domainName,
        proxied: true,
        ttl: 1
      }, { parent: this });

      // Page rules for caching
      new cloudflare.PageRule(`${name}-cf-cache-rule`, {
        zoneId: cloudflareZone.then(z => z.id),
        target: `${args.customDomain}/static/*`,
        priority: 1,
        actions: {
          cacheLevel: 'cache_everything',
          edgeCacheTtl: 2592000, // 30 days
          browserCacheTtl: 86400 // 1 day
        }
      }, { parent: this });

      // Security rules
      if (args.enableWAF) {
        new cloudflare.RuleSet(`${name}-cf-waf`, {
          zoneId: cloudflareZone.then(z => z.id),
          name: `${name}-security-rules`,
          kind: 'zone',
          phase: 'http_request_firewall_custom',
          rules: [
            {
              action: 'block',
              expression: '(cf.threat_score > 30)',
              description: 'Block high threat score'
            },
            {
              action: 'challenge',
              expression: '(cf.bot_score < 30)',
              description: 'Challenge suspicious bots'
            }
          ]
        }, { parent: this });
      }
    }

    this.registerOutputs({
      distribution: this.distribution,
      domainName: this.domainName,
      resourceCount: this.resourceCount
    });
  }

  private createCloudfrontFunction(name: string, code: string): aws.cloudfront.Function {
    return new aws.cloudfront.Function(name, {
      runtime: 'cloudfront-js-1.0',
      comment: `Security headers for ${name}`,
      code: code
    }, { parent: this });
  }

  private getSecurityHeadersFunction(): string {
    return `
function handler(event) {
  var response = event.response;
  var headers = response.headers;
  
  // Security headers
  headers['strict-transport-security'] = { value: 'max-age=63072000; includeSubdomains; preload' };
  headers['x-content-type-options'] = { value: 'nosniff' };
  headers['x-frame-options'] = { value: 'DENY' };
  headers['x-xss-protection'] = { value: '1; mode=block' };
  headers['referrer-policy'] = { value: 'strict-origin-when-cross-origin' };
  headers['content-security-policy'] = { 
    value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
  };
  
  return response;
}
    `;
  }
}