import { config } from '../src/config/config';

describe('Config', () => {
  it('should have required configuration properties', () => {
    expect(config).toHaveProperty('twitter');
    expect(config).toHaveProperty('gemini');
    expect(config).toHaveProperty('blockchain');
    expect(config).toHaveProperty('newsSources');
  });

  it('should have valid news sources', () => {
    expect(config.newsSources).toBeInstanceOf(Array);
    expect(config.newsSources.length).toBeGreaterThan(0);
    expect(config.newsSources[0]).toHaveProperty('url');
    expect(config.newsSources[0]).toHaveProperty('type');
    expect(config.newsSources[0]).toHaveProperty('category');
  });
});