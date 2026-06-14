export class KubernetesOrchestrator {
  async deployPlugin(_opts: any): Promise<void> {}
  async checkPluginHealth(_namespace: string, _name: string): Promise<boolean> { return true; }
}
