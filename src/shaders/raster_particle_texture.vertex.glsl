in ivec2 a_pos;

out vec2 v_tex_pos;

void main() {
    vec2 uv = 0.5 * vec2(a_pos) + vec2(0.5);
    v_tex_pos = uv;
#ifdef VIEWPORT_ORIGIN_TOP_LEFT
    v_tex_pos.y = 1.0 - v_tex_pos.y;
#endif
    gl_Position = vec4(a_pos, 0.0, 1.0);
}
