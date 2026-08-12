import { ProductModule } from './product.module';

describe('ProductModule startup behavior', () => {
  it('does not seed reference data during application startup', () => {
    expect(Object.prototype.hasOwnProperty.call(ProductModule.prototype, 'onModuleInit')).toBe(
      false,
    );
  });
});
