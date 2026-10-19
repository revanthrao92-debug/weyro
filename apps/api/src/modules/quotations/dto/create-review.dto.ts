import { CreateReviewSchema, CreateReviewInput } from '@weyro/validation';

export class CreateReviewDto implements CreateReviewInput {
  static readonly schema = CreateReviewSchema;

  rating!: number;
  comment?: string;
}
