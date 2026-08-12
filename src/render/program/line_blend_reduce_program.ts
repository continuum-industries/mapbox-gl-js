import {
    Uniform1i,
    Uniform2f,
    type UniformValues
} from '../uniform_binding';

import type Context from '../../gl/context';

export type LineBlendReduceUniformsType = {
    ['u_image']: Uniform1i;
    ['u_texel_size']: Uniform2f;
    ['u_first_pass']: Uniform1i;
};

export const lineBlendReduceUniforms = (context: Context): LineBlendReduceUniformsType => ({
    'u_image': new Uniform1i(context),
    'u_texel_size': new Uniform2f(context),
    'u_first_pass': new Uniform1i(context),
});

export const lineBlendReduceUniformValues = (
    textureUnit: number,
    texelSize: [number, number],
    firstPass: boolean,
): UniformValues<LineBlendReduceUniformsType> => ({
    'u_image': textureUnit,
    'u_texel_size': texelSize,
    'u_first_pass': firstPass ? 1 : 0,
});
