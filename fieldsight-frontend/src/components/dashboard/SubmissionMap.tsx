import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

import type { ApiSubmission } from "../../services/apiClient";
import { formatLocation, parseKoboCoordinates } from "../../utils/location";

export function SubmissionMap({ submissions }: { submissions: ApiSubmission[] }) {
  const points = submissions.flatMap((submission) => {
    const coordinates = parseKoboCoordinates(submission.location);
    return coordinates ? [{ submission, ...coordinates }] : [];
  });

  if (!points.length) {
    return (
      <div className="grid h-[300px] place-items-center rounded-lg bg-[#f5f8fc] px-6 text-center text-xs text-[#8190a4]">
        No GPS coordinates are available for this view.
      </div>
    );
  }

  const bounds = points.map((point) => [point.latitude, point.longitude] as [number, number]);
  return (
    <MapContainer bounds={bounds} boundsOptions={{ padding: [28, 28] }} className="h-[300px] w-full rounded-lg" scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map(({ submission, latitude, longitude }) => (
        <CircleMarker
          key={submission.id}
          center={[latitude, longitude]}
          radius={7}
          pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#0b51b7", fillOpacity: 0.88 }}
        >
          <Popup>
            <strong>{submission.project_name}</strong>
            <br />
            {formatLocation(submission.location)}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
