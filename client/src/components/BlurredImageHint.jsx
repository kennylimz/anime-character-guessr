import { useEffect, useRef, useState } from 'react';
import Image from './Image';

function BlurredImageHint({ src, blurRadius, alt = 'Hint', height = 200 }) {
  const canvasRef = useRef(null);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    if (!src) return;
    setUseFallback(false);

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = src;

    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setUseFallback(true);
        return;
      }

      const intrinsicWidth = img.naturalWidth || 300;
      const intrinsicHeight = img.naturalHeight || 300;
      canvas.width = intrinsicWidth;
      canvas.height = intrinsicHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (blurRadius > 0) {
        ctx.filter = `blur(${blurRadius * (intrinsicHeight / height)}px)`;
      } else {
        ctx.filter = 'none';
      }

      try {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      } catch (err) {
        setUseFallback(true);
      }
    };

    img.onerror = () => {
      setUseFallback(true);
    };
  }, [src, blurRadius, height]);

  const preventActions = (e) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  return (
    <div
      className="blurred-hint-wrapper"
      style={{
        position: 'relative',
        display: 'inline-block',
        height: `${height}px`,
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        WebkitUserDrag: 'none',
        borderRadius: '8px'
      }}
      onContextMenu={preventActions}
      onDragStart={preventActions}
      onMouseDown={preventActions}
    >
      {!useFallback ? (
        <canvas
          ref={canvasRef}
          style={{
            height: `${height}px`,
            width: 'auto',
            display: 'block',
            pointerEvents: 'none',
            userSelect: 'none',
            WebkitUserDrag: 'none'
          }}
          draggable="false"
        />
      ) : (
        <Image
          className="hint-image"
          src={src}
          style={{
            height: `${height}px`,
            filter: `blur(${blurRadius}px)`,
            pointerEvents: 'none',
            userSelect: 'none',
            WebkitUserDrag: 'none'
          }}
          alt={alt}
          draggable="false"
          onDragStart={preventActions}
          onContextMenu={preventActions}
        />
      )}

      {/* 透明物理遮罩层，完全阻断所有鼠标及触摸拖拽/右键菜单事件 */}
      <div
        className="image-protection-overlay"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10,
          backgroundColor: 'rgba(0, 0, 0, 0)',
          cursor: 'default',
          userSelect: 'none',
          WebkitUserDrag: 'none'
        }}
        draggable="false"
        onContextMenu={preventActions}
        onDragStart={preventActions}
        onMouseDown={preventActions}
        onTouchStart={preventActions}
      />
    </div>
  );
}

export default BlurredImageHint;
