import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  Optional,
  PipeTransform,
} from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  // As APP_PIPE the schema is absent (schemas come from DTO metatypes); when
  // used per-argument (`new ZodValidationPipe(schema)`) it is provided.
  constructor(@Optional() private schema?: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (
      metadata.type !== 'body' &&
      metadata.type !== 'query' &&
      metadata.type !== 'param'
    ) {
      return value;
    }

    const schemaToUse = this.schema || (metadata.metatype as any)?.schema;

    if (!schemaToUse) {
      return value;
    }

    try {
      return schemaToUse.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Validation failed',
          issues,
        });
      }
      throw new BadRequestException('Validation failed');
    }
  }
}
