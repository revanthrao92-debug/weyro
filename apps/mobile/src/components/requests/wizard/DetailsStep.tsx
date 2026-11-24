import { SectionHead } from '@/components/ui';
import { PhotoPicker } from '../PhotoPicker';
import type { UploadedImage } from '@/services/uploads';
import { type DraftValues, type RequestErrorMap, type ServiceConfig } from '../serviceRequestConfig';

import { FieldBlock } from './WizardParts';

export function DetailsStep({ config, values, errors, setValue, photos, setPhotos, uploading, setUploading }: {
  config: ServiceConfig;
  values: DraftValues;
  errors: RequestErrorMap;
  setValue: (key: string, value: string) => void;
  photos: UploadedImage[];
  setPhotos: (images: UploadedImage[]) => void;
  uploading: boolean;
  setUploading: (busy: boolean) => void;
}) {
  return (
    <>
      <SectionHead title={config.detailsTitle} />
      {config.fields.map((field) => (
        <FieldBlock
          key={field.key}
          field={field}
          value={values[field.key] ?? ''}
          error={errors[field.key]}
          onChange={(next) => setValue(field.key, next)}
        />
      ))}

      {config.photos ? (
        <>
          <SectionHead title={config.photos.label} />
          <PhotoPicker
            images={photos}
            onChange={setPhotos}
            max={config.photos.max}
            onUploadingChange={setUploading}
            helper={
              uploading ? 'Uploading photos…' : config.photos.help
            }
          />
        </>
      ) : null}
    </>
  );
}
