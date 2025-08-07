# Template Creation Guide

## Overview

The template creation feature allows you to create custom Backstage templates for scaffolding new services, applications, and infrastructure components.

## Accessing Template Creation

1. Navigate to the Template Marketplace at `/templates/marketplace`
2. Click the "Create Template" button in the header
3. Or directly access `/templates/create`

## Features

### 1. Form-Based Editor
- **Metadata Section**: Configure template name, title, description, and tags
- **Specification Section**: Set owner, type, and lifecycle
- **Parameters Builder**: Create dynamic input forms with various field types
- **Steps Builder**: Define actions like fetch, publish, and register

### 2. YAML Editor
- Full YAML editing with syntax highlighting
- Real-time validation
- Auto-completion support
- Error indicators

### 3. Template Preview
- Preview how the template will appear in the marketplace
- Test parameter inputs
- Visualize the scaffolding flow

### 4. Import/Export
- Import existing templates from YAML files
- Export created templates for version control
- Copy templates from other sources

## Creating a Template

### Step 1: Basic Information
```yaml
metadata:
 name: my-service-template
 title: My Service Template
 description: Creates a new microservice
 tags:
 - backend
 - nodejs
```

### Step 2: Define Parameters
Parameters create the input form users will fill out:

```yaml
parameters:
 - title: Service Details
 required:
 - name
 - description
 properties:
 name:
 title: Service Name
 type: string
 pattern: '^[a-z0-9-]+$'
 description:
 title: Description
 type: string
```

### Step 3: Configure Steps
Steps define what happens when the template is executed:

```yaml
steps:
 - id: fetch
 name: Fetch Base
 action: fetch:template
 input:
 url: ./skeleton
 values:
 name: ${{ parameters.name }}
 
 - id: publish
 name: Publish to GitHub
 action: publish:github
 input:
 repoUrl: ${{ parameters.repoUrl }}
 
 - id: register
 name: Register in Catalog
 action: catalog:register
 input:
 repoContentsUrl: ${{ steps.publish.output.repoContentsUrl }}
```

## Validation

Templates are validated for:
- Valid YAML syntax
- Required fields presence
- Correct API version (`scaffolder.backstage.io/v1beta3`)
- Valid actions in steps
- Parameter schema validation

## Testing Templates

1. Use the "Test Template" button to simulate execution
2. Fill in sample parameters
3. Review the generated preview
4. Check for any validation errors

## Best Practices

1. **Naming Convention**: Use lowercase with hyphens (e.g., `nodejs-service`)
2. **Clear Descriptions**: Provide detailed descriptions for better discoverability
3. **Input Validation**: Add patterns and constraints to parameters
4. **Meaningful Tags**: Use relevant tags for categorization
5. **Error Handling**: Include validation for all required inputs
6. **Documentation**: Add help text to complex parameters

## Example Templates

Check the `test-templates/` directory for examples:
- `node-microservice.yaml` - Node.js service with Express
- `react-app.yaml` - React SPA with TypeScript
- `python-api.yaml` - Python FastAPI service

## Troubleshooting

### Common Issues

1. **Validation Errors**: Check YAML syntax and required fields
2. **Parameter Issues**: Ensure all referenced parameters exist
3. **Step Failures**: Verify action names and input formats

### Getting Help

- Check the template documentation at `/docs/templates`
- Review existing templates in the marketplace
- Contact the platform team for assistance