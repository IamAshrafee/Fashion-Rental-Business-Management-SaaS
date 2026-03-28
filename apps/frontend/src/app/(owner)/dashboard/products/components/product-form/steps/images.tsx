import { useFormContext, useFieldArray } from 'react-hook-form';
import { ProductFormValues } from '../schema';
import { FormField, FormItem, FormMessage } from '@/components/ui/form';
import { ImageUploader } from '@/components/shared/image-uploader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function ImagesStep() {
  const { control, watch } = useFormContext<ProductFormValues>();
  
  const variants = watch('variants') || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Product Images</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload and order images for each color variant. The first image marked with a star will be the featured thumbnail.
        </p>
      </div>

      <Tabs defaultValue={`variant-0`} className="space-y-4">
        {variants.length > 1 && (
          <TabsList className="w-full justify-start overflow-x-auto">
            {variants.map((variant, index) => (
              <TabsTrigger key={`trigger-${index}`} value={`variant-${index}`}>
                {variant.name || `Variant ${index + 1}`}
              </TabsTrigger>
            ))}
          </TabsList>
        )}

        {variants.map((variant, index) => (
          <TabsContent key={`content-${index}`} value={`variant-${index}`}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{variant.name || `Variant ${index + 1}`}</CardTitle>
                <CardDescription>Drag to reorder. Required to have at least 1 image.</CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={control}
                  name={`variants.${index}.images`}
                  render={({ field }) => (
                    <FormItem>
                      <ImageUploader
                        images={field.value}
                        onChange={field.onChange}
                        maxImages={10}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
