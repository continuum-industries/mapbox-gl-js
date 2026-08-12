export function mercatorXfromLng(lng: number): number {
    return (180 + lng) / 360;
}

export function mercatorYfromLat(lat: number): number {
    return (180 - (180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)))) / 360;
}

export function lngFromMercatorX(x: number): number {
    return x * 360 - 180;
}

export function latFromMercatorY(y: number): number {
    const y2 = 180 - y * 360;
    return 360 / Math.PI * Math.atan(Math.exp(y2 * Math.PI / 180)) - 90;
}
