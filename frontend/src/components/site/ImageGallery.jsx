/**
 * 图集（DESIGN：1 主 2 副 + 点击大图开灯箱；≤768px 横滑）
 *
 * props：images=[], title
 *
 * 灯箱复用 Modal（plain 纯图，无边框）。图片多于 3 张时，第三格右上叠「+N」。
 *
 * 用法：<ImageGallery images={scenic.gallery} title={scenic.name} />
 */

import { useState } from 'react';

import Modal from '../ui/Modal.jsx';

/**
 * 图集。
 * @param {{ images?: string[], title?: string }} props
 * @returns {JSX.Element|null}
 */
export function ImageGallery({ images = [], title = '' }) {
  const list = (Array.isArray(images) ? images : []).filter(Boolean);
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  if (!list.length) return null;

  const main = list[0];
  const side = list.slice(1, 3);
  const extra = list.length - 3;

  /**
   * 打开灯箱。
   * @param {number} index
   */
  const openAt = (index) => setLightboxIndex(index);

  return (
    <>
      <div className="gallery">
        <div
          className="gallery__main"
          role="button"
          tabIndex={0}
          onClick={() => openAt(0)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openAt(0);
            }
          }}
          aria-label={`查看大图：${title || '景区图片'}`}
        >
          <img src={main} alt={title || '景区图片'} loading="lazy" />
        </div>

        {side.map((src, index) => {
          const realIndex = index + 1;
          const isLast = index === side.length - 1;
          return (
            <div
              key={`${src}-${realIndex}`}
              className="gallery__thumb"
              role="button"
              tabIndex={0}
              onClick={() => openAt(realIndex)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openAt(realIndex);
                }
              }}
              aria-label={`查看第 ${realIndex + 1} 张图片`}
            >
              <img src={src} alt={`${title} 图 ${realIndex + 1}`} loading="lazy" />
              {isLast && extra > 0 ? (
                <span className="gallery__more" aria-hidden="true">
                  +{extra}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <Modal open={lightboxIndex >= 0} onClose={() => setLightboxIndex(-1)} plain size="md">
        {lightboxIndex >= 0 ? (
          <img className="modal__image" src={list[lightboxIndex]} alt={`${title} 图 ${lightboxIndex + 1}`} />
        ) : null}
      </Modal>
    </>
  );
}

export default ImageGallery;
