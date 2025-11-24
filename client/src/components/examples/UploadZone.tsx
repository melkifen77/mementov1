import { UploadZone } from '../UploadZone';

export default function UploadZoneExample() {
  return (
    <UploadZone 
      onUpload={(data) => console.log('Uploaded:', data)} 
    />
  );
}
