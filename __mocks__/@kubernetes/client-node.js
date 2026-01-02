// Mock @kubernetes/client-node for Jest testing
const kubernetesMock = {
  // Kubernetes API classes
  KubernetesApi: jest.fn().mockImplementation(() => ({
    getAPIResources: jest.fn().mockResolvedValue({ body: { resources: [] } }),
  })),

  AppsV1Api: jest.fn().mockImplementation(() => ({
    listNamespacedDeployment: jest.fn().mockResolvedValue({ body: { items: [] } }),
    createNamespacedDeployment: jest.fn().mockResolvedValue({ body: {} }),
    readNamespacedDeployment: jest.fn().mockResolvedValue({ body: {} }),
    replaceNamespacedDeployment: jest.fn().mockResolvedValue({ body: {} }),
    deleteNamespacedDeployment: jest.fn().mockResolvedValue({ body: {} }),
    patchNamespacedDeployment: jest.fn().mockResolvedValue({ body: {} }),
    listNamespacedStatefulSet: jest.fn().mockResolvedValue({ body: { items: [] } }),
    createNamespacedStatefulSet: jest.fn().mockResolvedValue({ body: {} }),
    listNamespacedDaemonSet: jest.fn().mockResolvedValue({ body: { items: [] } }),
    createNamespacedDaemonSet: jest.fn().mockResolvedValue({ body: {} }),
    listNamespacedReplicaSet: jest.fn().mockResolvedValue({ body: { items: [] } }),
  })),

  CoreV1Api: jest.fn().mockImplementation(() => ({
    listNamespacedPod: jest.fn().mockResolvedValue({ body: { items: [] } }),
    createNamespacedPod: jest.fn().mockResolvedValue({ body: {} }),
    readNamespacedPod: jest.fn().mockResolvedValue({ body: {} }),
    deleteNamespacedPod: jest.fn().mockResolvedValue({ body: {} }),
    listNamespacedService: jest.fn().mockResolvedValue({ body: { items: [] } }),
    createNamespacedService: jest.fn().mockResolvedValue({ body: {} }),
    readNamespacedService: jest.fn().mockResolvedValue({ body: {} }),
    deleteNamespacedService: jest.fn().mockResolvedValue({ body: {} }),
    listNamespacedConfigMap: jest.fn().mockResolvedValue({ body: { items: [] } }),
    createNamespacedConfigMap: jest.fn().mockResolvedValue({ body: {} }),
    readNamespacedConfigMap: jest.fn().mockResolvedValue({ body: {} }),
    replaceNamespacedConfigMap: jest.fn().mockResolvedValue({ body: {} }),
    deleteNamespacedConfigMap: jest.fn().mockResolvedValue({ body: {} }),
    listNamespacedSecret: jest.fn().mockResolvedValue({ body: { items: [] } }),
    createNamespacedSecret: jest.fn().mockResolvedValue({ body: {} }),
    readNamespacedSecret: jest.fn().mockResolvedValue({ body: {} }),
    deleteNamespacedSecret: jest.fn().mockResolvedValue({ body: {} }),
    createNamespace: jest.fn().mockResolvedValue({ body: {} }),
    readNamespace: jest.fn().mockResolvedValue({ body: {} }),
    listNamespace: jest.fn().mockResolvedValue({ body: { items: [] } }),
    readNamespacedPodLog: jest.fn().mockResolvedValue({ body: '' }),
    listNode: jest.fn().mockResolvedValue({ body: { items: [] } }),
  })),

  NetworkingV1Api: jest.fn().mockImplementation(() => ({
    listNamespacedIngress: jest.fn().mockResolvedValue({ body: { items: [] } }),
    createNamespacedIngress: jest.fn().mockResolvedValue({ body: {} }),
    readNamespacedIngress: jest.fn().mockResolvedValue({ body: {} }),
    deleteNamespacedIngress: jest.fn().mockResolvedValue({ body: {} }),
  })),

  BatchV1Api: jest.fn().mockImplementation(() => ({
    listNamespacedJob: jest.fn().mockResolvedValue({ body: { items: [] } }),
    createNamespacedJob: jest.fn().mockResolvedValue({ body: {} }),
    listNamespacedCronJob: jest.fn().mockResolvedValue({ body: { items: [] } }),
    createNamespacedCronJob: jest.fn().mockResolvedValue({ body: {} }),
  })),

  RbacAuthorizationV1Api: jest.fn().mockImplementation(() => ({
    listNamespacedRole: jest.fn().mockResolvedValue({ body: { items: [] } }),
    createNamespacedRole: jest.fn().mockResolvedValue({ body: {} }),
    listNamespacedRoleBinding: jest.fn().mockResolvedValue({ body: { items: [] } }),
    createNamespacedRoleBinding: jest.fn().mockResolvedValue({ body: {} }),
    listClusterRole: jest.fn().mockResolvedValue({ body: { items: [] } }),
    createClusterRole: jest.fn().mockResolvedValue({ body: {} }),
  })),

  CustomObjectsApi: jest.fn().mockImplementation(() => ({
    listNamespacedCustomObject: jest.fn().mockResolvedValue({ body: { items: [] } }),
    createNamespacedCustomObject: jest.fn().mockResolvedValue({ body: {} }),
    getNamespacedCustomObject: jest.fn().mockResolvedValue({ body: {} }),
    patchNamespacedCustomObject: jest.fn().mockResolvedValue({ body: {} }),
    deleteNamespacedCustomObject: jest.fn().mockResolvedValue({ body: {} }),
  })),

  // KubeConfig for cluster configuration
  KubeConfig: jest.fn().mockImplementation(() => ({
    loadFromDefault: jest.fn(),
    loadFromCluster: jest.fn(),
    loadFromFile: jest.fn(),
    loadFromString: jest.fn(),
    makeApiClient: jest.fn((ApiClass) => new ApiClass()),
    getCurrentContext: jest.fn(() => 'default'),
    getCurrentCluster: jest.fn(() => ({ name: 'test-cluster', server: 'https://localhost:6443' })),
    getCurrentUser: jest.fn(() => ({ name: 'test-user' })),
    getContexts: jest.fn(() => [{ name: 'default', cluster: 'test-cluster', user: 'test-user' }]),
    getClusters: jest.fn(() => [{ name: 'test-cluster', server: 'https://localhost:6443' }]),
    getUsers: jest.fn(() => [{ name: 'test-user' }]),
    setCurrentContext: jest.fn(),
    addContext: jest.fn(),
    addCluster: jest.fn(),
    addUser: jest.fn(),
  })),

  // Watch for monitoring resources
  Watch: jest.fn().mockImplementation(() => ({
    watch: jest.fn().mockResolvedValue({ body: {} }),
  })),

  // Metrics API
  Metrics: jest.fn().mockImplementation(() => ({
    getNodeMetrics: jest.fn().mockResolvedValue({ items: [] }),
    getPodMetrics: jest.fn().mockResolvedValue({ items: [] }),
  })),

  // Type definitions (V1* objects)
  V1Deployment: jest.fn().mockImplementation(() => ({
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {},
    spec: {},
  })),

  V1Service: jest.fn().mockImplementation(() => ({
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {},
    spec: {},
  })),

  V1ConfigMap: jest.fn().mockImplementation(() => ({
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {},
    data: {},
  })),

  V1Secret: jest.fn().mockImplementation(() => ({
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: {},
    data: {},
  })),

  V1Pod: jest.fn().mockImplementation(() => ({
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: {},
    spec: {},
    status: {},
  })),

  V1Namespace: jest.fn().mockImplementation(() => ({
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: {},
  })),

  V1ServiceAccount: jest.fn().mockImplementation(() => ({
    apiVersion: 'v1',
    kind: 'ServiceAccount',
    metadata: {},
  })),

  V1PersistentVolumeClaim: jest.fn().mockImplementation(() => ({
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    metadata: {},
    spec: {},
  })),

  V1Ingress: jest.fn().mockImplementation(() => ({
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: {},
    spec: {},
  })),

  V1Job: jest.fn().mockImplementation(() => ({
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: {},
    spec: {},
  })),

  V1CronJob: jest.fn().mockImplementation(() => ({
    apiVersion: 'batch/v1',
    kind: 'CronJob',
    metadata: {},
    spec: {},
  })),

  // ObjectMeta helper
  V1ObjectMeta: jest.fn().mockImplementation(() => ({
    name: '',
    namespace: '',
    labels: {},
    annotations: {},
  })),

  // Container spec
  V1Container: jest.fn().mockImplementation(() => ({
    name: '',
    image: '',
    ports: [],
    env: [],
    resources: {},
  })),
};

module.exports = kubernetesMock;
