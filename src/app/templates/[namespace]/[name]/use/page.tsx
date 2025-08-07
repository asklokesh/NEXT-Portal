'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
 ArrowLeft, 
 ArrowRight, 
 Play, 
 Loader2, 
 CheckCircle, 
 AlertCircle,
 FileText,
 GitBranch,
 Settings,
 Users,
 Code,
 Info
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { backstageClient, type TemplateEntityV1beta3 } from '@/lib/backstage/client';

interface PageParams {
 params: Promise<{
 namespace: string;
 name: string;
 }>;
}

interface FormValues {
 [key: string]: any;
}

const TemplateUsePage = ({ params }: PageParams) => {
 const router = useRouter();
 const [template, setTemplate] = useState<TemplateEntityV1beta3 | null>(null);
 const [loading, setLoading] = useState(true);
 const [executing, setExecuting] = useState(false);
 const [currentStep, setCurrentStep] = useState(0);
 const [formValues, setFormValues] = useState<FormValues>({});
 const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

 useEffect(() => {
 loadTemplate();
 }, []);

 const loadTemplate = async () => {
 try {
 setLoading(true);
 const { namespace, name } = await params;
 const templateRef = `Template:${namespace}/${name}`;
 const templateData = await backstageClient.getTemplate(templateRef);
 setTemplate(templateData);
 
 // Initialize form values with defaults
 const initialValues: FormValues = {};
 templateData.spec.parameters?.forEach((param) => {
 const properties = param.properties || {};
 Object.entries(properties).forEach(([key, prop]: [string, any]) => {
 if (prop.default !== undefined) {
 initialValues[key] = prop.default;
 }
 });
 });
 setFormValues(initialValues);
 } catch (error) {
 console.error('Failed to load template:', error);
 toast.error('Failed to load template');
 router.push('/templates/marketplace');
 } finally {
 setLoading(false);
 }
 };

 const validateStep = (stepIndex: number): boolean => {
 if (!template) return false;
 
 const step = template.spec.parameters?.[stepIndex];
 if (!step) return true;
 
 const errors: Record<string, string> = {};
 const required = step.required || [];
 const properties = step.properties || {};
 
 required.forEach((field) => {
 if (!formValues[field] || formValues[field] === '') {
 errors[field] = 'This field is required';
 }
 });
 
 // Additional validation based on property schemas
 Object.entries(properties).forEach(([key, prop]: [string, any]) => {
 const value = formValues[key];
 
 if (prop.pattern && value && typeof value === 'string') {
 const regex = new RegExp(prop.pattern);
 if (!regex.test(value)) {
 errors[key] = prop.description || 'Invalid format';
 }
 }
 
 if (prop.minLength && value && value.length < prop.minLength) {
 errors[key] = `Minimum length is ${prop.minLength}`;
 }
 
 if (prop.maxLength && value && value.length > prop.maxLength) {
 errors[key] = `Maximum length is ${prop.maxLength}`;
 }
 });
 
 setValidationErrors(errors);
 return Object.keys(errors).length === 0;
 };

 const handleNext = () => {
 if (validateStep(currentStep)) {
 setCurrentStep(currentStep + 1);
 }
 };

 const handleBack = () => {
 setCurrentStep(currentStep - 1);
 };

 const handleExecute = async () => {
 if (!template) return;
 
 // Validate all steps
 let allValid = true;
 for (let i = 0; i < (template.spec.parameters?.length || 0); i++) {
 if (!validateStep(i)) {
 allValid = false;
 setCurrentStep(i);
 break;
 }
 }
 
 if (!allValid) {
 toast.error('Please fix validation errors before executing');
 return;
 }
 
 try {
 setExecuting(true);
 
 // Execute template via Backstage scaffolder
 const templateRef = `Template:${template.metadata.namespace || 'default'}/${template.metadata.name}`;
 const taskId = await backstageClient.executeTemplate(templateRef, formValues);
 
 toast.success('Template execution started!');
 
 // Redirect to execution progress page
 router.push(`/templates/execute?template=${templateRef}&taskId=${taskId}`);
 } catch (error) {
 console.error('Failed to execute template:', error);
 toast.error('Failed to execute template');
 } finally {
 setExecuting(false);
 }
 };

 const renderFormField = (key: string, property: any) => {
 const value = formValues[key] || '';
 const error = validationErrors[key];
 
 // Handle different UI field types
 if (property.ui?.field === 'RepoUrlPicker') {
 return (
 <div key={key} className="space-y-2">
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
 {property.title || key}
 {property.description && (
 <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
 {property.description}
 </span>
 )}
 </label>
 <div className="grid grid-cols-2 gap-4">
 <input
 type="text"
 placeholder="Repository owner"
 value={formValues[`${key}_owner`] || ''}
 onChange={(e) => setFormValues({
 ...formValues,
 [`${key}_owner`]: e.target.value,
 [key]: `github.com?owner=${e.target.value}&repo=${formValues[`${key}_repo`] || ''}`
 })}
 className={`px-4 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${
 error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
 }`}
 />
 <input
 type="text"
 placeholder="Repository name"
 value={formValues[`${key}_repo`] || ''}
 onChange={(e) => setFormValues({
 ...formValues,
 [`${key}_repo`]: e.target.value,
 [key]: `github.com?owner=${formValues[`${key}_owner`] || ''}&repo=${e.target.value}`
 })}
 className={`px-4 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${
 error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
 }`}
 />
 </div>
 {error && <p className="text-sm text-red-600">{error}</p>}
 </div>
 );
 }
 
 if (property.ui?.field === 'OwnerPicker') {
 return (
 <div key={key} className="space-y-2">
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
 {property.title || key}
 {property.description && (
 <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
 {property.description}
 </span>
 )}
 </label>
 <select
 value={value}
 onChange={(e) => setFormValues({ ...formValues, [key]: e.target.value })}
 className={`w-full px-4 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${
 error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
 }`}
 >
 <option value="">Select owner...</option>
 <option value="team-platform">Platform Team</option>
 <option value="team-frontend">Frontend Team</option>
 <option value="team-backend">Backend Team</option>
 <option value="team-data">Data Team</option>
 </select>
 {error && <p className="text-sm text-red-600">{error}</p>}
 </div>
 );
 }
 
 // Default text input
 return (
 <div key={key} className="space-y-2">
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
 {property.title || key}
 {property.description && (
 <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
 {property.description}
 </span>
 )}
 </label>
 <input
 type={property.type === 'number' ? 'number' : 'text'}
 value={value}
 onChange={(e) => setFormValues({ ...formValues, [key]: e.target.value })}
 placeholder={property.placeholder}
 className={`w-full px-4 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${
 error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
 }`}
 />
 {error && <p className="text-sm text-red-600">{error}</p>}
 </div>
 );
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center h-96">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
 </div>
 );
 }

 if (!template) {
 return (
 <div className="text-center py-12">
 <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
 Template not found
 </h3>
 <button
 onClick={() => router.push('/templates/marketplace')}
 className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
 >
 <ArrowLeft className="w-4 h-4" />
 Back to Marketplace
 </button>
 </div>
 );
 }

 const totalSteps = template.spec.parameters?.length || 0;
 const currentStepData = template.spec.parameters?.[currentStep];
 const isLastStep = currentStep === totalSteps - 1;

 return (
 <div className="max-w-4xl mx-auto space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <button
 onClick={() => router.push('/templates/marketplace')}
 className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
 >
 <ArrowLeft className="w-5 h-5" />
 </button>
 <div>
 <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 {template.metadata.title || template.metadata.name}
 </h1>
 <p className="text-gray-600 dark:text-gray-400">
 {template.metadata.description}
 </p>
 </div>
 </div>
 </div>

 {/* Progress */}
 {totalSteps > 1 && (
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between mb-4">
 {Array.from({ length: totalSteps }).map((_, index) => (
 <div key={index} className="flex items-center">
 <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
 index < currentStep ? 'bg-green-600 text-white' :
 index === currentStep ? 'bg-blue-600 text-white' :
 'bg-gray-200 dark:bg-gray-700 text-gray-500'
 }`}>
 {index < currentStep ? (
 <CheckCircle className="w-5 h-5" />
 ) : (
 <span className="text-sm font-medium">{index + 1}</span>
 )}
 </div>
 {index < totalSteps - 1 && (
 <div className={`w-full h-1 mx-2 ${
 index < currentStep ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'
 }`} />
 )}
 </div>
 ))}
 </div>
 <div className="text-center">
 <p className="text-sm text-gray-600 dark:text-gray-400">
 Step {currentStep + 1} of {totalSteps}: {currentStepData?.title || 'Configuration'}
 </p>
 </div>
 </div>
 )}

 {/* Form */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 {currentStepData && (
 <div>
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
 {currentStepData.title}
 </h2>
 <div className="space-y-6">
 {Object.entries(currentStepData.properties || {}).map(([key, property]) => 
 renderFormField(key, property)
 )}
 </div>
 </div>
 )}
 </div>

 {/* Actions */}
 <div className="flex items-center justify-between">
 <button
 onClick={handleBack}
 disabled={currentStep === 0}
 className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <ArrowLeft className="w-4 h-4" />
 Back
 </button>
 
 {isLastStep ? (
 <button
 onClick={handleExecute}
 disabled={executing}
 className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
 >
 {executing ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <Play className="w-4 h-4" />
 )}
 Execute Template
 </button>
 ) : (
 <button
 onClick={handleNext}
 className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
 >
 Next
 <ArrowRight className="w-4 h-4" />
 </button>
 )}
 </div>
 </div>
 );
};

export default TemplateUsePage;