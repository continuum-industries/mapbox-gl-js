in highp vec3 a_pos_3f;

uniform mat3 u_matrix_3f;

out highp vec3 v_position;

float map(float value, float start, float end, float new_start, float new_end) {
    return ((value - start) * (new_end - new_start)) / (end - start) + new_start;
}

void main() {
    vec4 pos = vec4(u_matrix_3f * a_pos_3f, 1.0);

    v_position = pos.xyz;
#ifndef VIEWPORT_ORIGIN_TOP_LEFT
    // OpenGL cubemap faces use a bottom-left origin; Metal uses top-left (see flipV in
    // render_sky_layer.cpp) so skip this flip when VIEWPORT_ORIGIN_TOP_LEFT is defined.
    v_position.y *= -1.0;
#endif

    // To make better utilization of the visible range (e.g. over the horizon, UVs
    // from 0.0 to 1.0 on the Y-axis in cubemap space), the UV range is remapped from
    // (-1.0,1.0) to (0.0,1.0) on y. The inverse operation is applied when sampling.
    v_position.y = map(v_position.y, -1.0, 1.0, 0.0, 1.0);

    gl_Position = vec4(a_pos_3f.xy, 0.0, 1.0);
}
