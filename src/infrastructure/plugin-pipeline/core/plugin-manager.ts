export class PluginManager {
  async validateDependencies(_plugin: any): Promise<void> {}
  async downloadPlugin(_plugin: any): Promise<any> { return {}; }
  async buildDockerImage(_pkg: any): Promise<string> { return ''; }
}
