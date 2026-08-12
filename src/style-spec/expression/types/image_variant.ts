import {ImageId} from './image_id';

import type Color from '../../util/color';
import type {Brand} from '../../types/brand';
import type {ImageIdSpec} from './image_id';

/**
 * `StringifiedImageVariant` is a stringified version of the `ImageVariant`.
 *
 * @private
 */
export type StringifiedImageVariant = Brand<string, 'ImageVariant'>;

/**
 * {@link ImageVariant} rasterization options.
 *
 * @private
 */
export type RasterizationOptions = {
    params?: Record<string, Color>;
    sx?: number;
    sy?: number;
};

/**
 * `ImageVariant` is a component of {@link ResolvedImage}
 * that represents either the primary or secondary image
 * along with its rendering configuration.
 *
 * @private
 */
export class ImageVariant implements RasterizationOptions {
    id: ImageId;
    params?: Record<string, Color>;
    sx: number;
    sy: number;

    constructor(id: string | ImageIdSpec, options: RasterizationOptions = {}) {
        this.id = ImageId.from(id);
        this.params = options.params;
        this.sx = options.sx || 1;
        this.sy = options.sy || 1;
    }

    toString(): StringifiedImageVariant {
        return JSON.stringify(this) as StringifiedImageVariant;
    }

    static parse(str: StringifiedImageVariant): ImageVariant | null {
        let id: ImageIdSpec | undefined;
        let params: Record<string, Color> | undefined;
        let sx: number | undefined;
        let sy: number | undefined;

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            ({id, params, sx, sy} = JSON.parse(str) || {});
        } catch (e) {
            return null;
        }

        if (!id) return null;

        return new ImageVariant(id, {params, sx, sy});
    }

    scaleSelf(factor: number, yFactor: number = factor): this {
        this.sx *= factor;
        this.sy *= yFactor;
        return this;
    }
}
