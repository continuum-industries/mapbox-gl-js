import drawModels, {prepare} from '../3d-style/render/draw_model';
import shaders from '../3d-style/shaders/shaders_standard';
import {programUniforms} from '../3d-style/render/program/program_uniforms_standard';
import {ShadowRenderer} from '../3d-style/render/shadow_renderer';
import {drawGroundEffect} from '../3d-style/render/draw_ground_effect';
import {queryModelLayerRendered, queryModelLayerIntersectsFeature, loadMatchingModelFeature} from '../3d-style/style/style_layer/model_layer_query';
import ModelSource from '../3d-style/source/model_source';
import Tiled3dModelSource from '../3d-style/source/tiled_3d_model_source';
import {loadModel} from '../3d-style/source/model_loader';
// Side-effect imports: register() calls ensure main-thread deserialization works
// when tiles carrying ModelBucket or Tiled3dModelBucket arrive from the worker.
import '../3d-style/data/bucket/model_bucket';
import '../3d-style/data/bucket/tiled_3d_model_bucket';

export const Standard = {
    loaded: true,
    drawModels,
    prepare,
    shaders,
    programUniforms,
    ShadowRenderer,
    drawGroundEffect,
    queryModelLayerRendered,
    queryModelLayerIntersectsFeature,
    loadMatchingModelFeature,
    ModelSource,
    Tiled3dModelSource,
    loadModel,
};
