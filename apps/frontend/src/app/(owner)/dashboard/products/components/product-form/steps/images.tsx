import { useFormContext, useFieldArray } from 'react-hook-form';
import { ProductFormValues } from '../schema';
import { FormField, FormItem, FormMessage } from '@/components/ui/form';
import { ImageUploader } from '@/components/shared/image-uploader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Check, AlertCircle, ImageIcon } from 'lucide-react';

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
          <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 flex-wrap">
            {variants.map((variant, index) => {
              const imageCount = variant.images?.length ?? 0;
              const hasImages = imageCount > 0;
              return (
                <TabsTrigger 
                  key={`trigger-${index}`} 
                  value={`variant-${index}`}
                  className="gap-2"
                >
                  <span>{variant.name || `Variant ${index + 1}`}</span>
                  <Badge 
                    variant={hasImages ? 'default' : 'destructive'}
                    className={`h-5 px-1.5 text-[10px] font-medium ${
                      hasImages 
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100'
                        : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100'
                    }`}
                  >
                    {hasImages ? (
                      <><Check className="h-3 w-3 mr-0.5" />{imageCount}</>
                    ) : (
                      <><AlertCircle className="h-3 w-3 mr-0.5" />0</>
                    )}
                  </Badge>
                </TabsTrigger>
              );
            })}
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
