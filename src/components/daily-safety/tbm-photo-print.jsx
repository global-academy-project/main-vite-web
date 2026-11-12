import { useEffect, useState } from 'react';
import { photoBlob } from '../../api/attachments.js';

export default function TbmPhotoPrint({ photos = [] }) {
  const [images, setImages] = useState([]);

  useEffect(() => {
    let active = true;
    const urls = [];

    Promise.all(photos.map(async (photo) => {
      try {
        const blob = await photoBlob(photo);
        const url = URL.createObjectURL(blob);
        urls.push(url);
        return { ...photo, previewUrl: url };
      } catch {
        return { ...photo, previewUrl: '' };
      }
    })).then((result) => {
      if (active) setImages(result);
    });

    return () => {
      active = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photos]);

  if (!photos.length) return <p className="safety-inspection-log__empty">해당 내용 없음</p>;

  return (
    <div className="safety-inspection-log__photos">
      {images.map((photo) => (
        <figure key={photo.attachmentId}>
          {photo.previewUrl ? (
            <img src={photo.previewUrl} alt={photo.fileName || `TBM 사진 ${photo.attachmentId}`} />
          ) : (
            <div className="safety-inspection-log__photo-error">사진을 불러오지 못했습니다.</div>
          )}
          <figcaption>
            사진 #{photo.attachmentId}
            {photo.takenAt && ` · 촬영 ${String(photo.takenAt).replace('T', ' ').slice(0, 16)}`}
            {photo.check?.result && ` · ${photo.check.result}`}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
