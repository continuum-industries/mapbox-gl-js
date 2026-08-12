export type BoxGeometryElement = {
    kind: 'box';
    left: number;
    top: number;
    right: number;
    bottom: number;
};

export type CircleGeometryElement = {
    kind: 'circle';
    x: number;
    y: number;
    radius: number;
};

export type GeometryElement = BoxGeometryElement | CircleGeometryElement;

export type Geometry = ReadonlyArray<GeometryElement>;

export function boxesIntersect(a: BoxGeometryElement, b: BoxGeometryElement): boolean {
    return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

export function circlesIntersect(a: CircleGeometryElement, b: CircleGeometryElement): boolean {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const r = a.radius + b.radius;
    return dx * dx + dy * dy < r * r;
}

export function circleIntersectsBox(circle: CircleGeometryElement, box: BoxGeometryElement): boolean {
    const halfWidth = (box.right - box.left) / 2;
    const distX = Math.abs(circle.x - (box.left + halfWidth));
    if (distX >= circle.radius + halfWidth) return false;

    const halfHeight = (box.bottom - box.top) / 2;
    const distY = Math.abs(circle.y - (box.top + halfHeight));
    if (distY >= circle.radius + halfHeight) return false;

    if (distX < halfWidth || distY < halfHeight) return true;

    const cornerX = distX - halfWidth;
    const cornerY = distY - halfHeight;
    return cornerX * cornerX + cornerY * cornerY < circle.radius * circle.radius;
}

export function geometryElementsIntersect(a: GeometryElement, b: GeometryElement): boolean {
    if (a.kind === 'box' && b.kind === 'box') return boxesIntersect(a, b);
    if (a.kind === 'circle' && b.kind === 'circle') return circlesIntersect(a, b);
    if (a.kind === 'circle') return circleIntersectsBox(a, b as BoxGeometryElement);
    return circleIntersectsBox(b as CircleGeometryElement, a);
}

export function extendGeometryElement(element: GeometryElement, padding: number): GeometryElement {
    if (padding === 0) return element;
    return element.kind === 'box' ?
        {kind: 'box', left: element.left - padding, top: element.top - padding, right: element.right + padding, bottom: element.bottom + padding} :
        {kind: 'circle', x: element.x, y: element.y, radius: element.radius + padding};
}
