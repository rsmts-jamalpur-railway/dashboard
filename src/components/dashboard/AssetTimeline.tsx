'use client';
import { useState } from 'react';
import classes from '../../app/(dashboard)/page.module.css';
import { FiX, FiImage } from 'react-icons/fi';

interface Photo {
  photo_url: string;
  createdAt: string;
}

interface MovementLog {
  log_id: string;
  asset_number: string;
  from_location: string | null;
  to_location: string;
  previous_status: string | null;
  new_status: string;
  timestamp: string;
  remarks: string | null;
  handler: { full_name: string };
  photos?: Photo[];
}

interface AssetTimelineProps {
  assetNumber: string;
  logs: MovementLog[];
  onClose: () => void;
}

export default function AssetTimeline({ assetNumber, logs, onClose }: AssetTimelineProps) {
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);

  // Sort logs chronologically (oldest first for a proper timeline flow, or newest first)
  // Dashboard usually prefers newest on top
  const sortedLogs = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <>
      <div className={classes.timelineOverlay} onClick={onClose}></div>
      <div className={classes.timelinePanel}>
        <div className={classes.timelineHeader}>
          <h3>Timeline: {assetNumber}</h3>
          <button onClick={onClose} className={classes.closeButton}>
            <FiX size={20} />
          </button>
        </div>
        
        <div className={classes.timelineBody}>
          {sortedLogs.map((log, index) => {
            const isLast = index === sortedLogs.length - 1;
            return (
              <div key={log.log_id} className={classes.timelineNode}>
                <div className={classes.timelineIndicator}></div>
                {!isLast && <div className={classes.timelineLine}></div>}
                
                <div className={classes.timelineContent}>
                  <div className={classes.timelineMeta}>
                    <span className={classes.timelineTime}>
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                    <span className={`${classes.statusBadge} ${classes[log.new_status.replace(/\s+/g, '')] || classes.defaultStatus}`}>
                      {log.new_status}
                    </span>
                  </div>
                  
                  <div className={classes.timelineDetails}>
                    <strong>{log.from_location || 'External'}</strong> ➔ <strong>{log.to_location}</strong>
                  </div>
                  
                  <div className={classes.timelineHandler}>
                    By {log.handler.full_name}
                  </div>

                  {log.remarks && (
                    <div className={classes.timelineRemarks}>
                      "{log.remarks}"
                    </div>
                  )}

                  {log.photos && log.photos.length > 0 && (
                    <div className={classes.photoGallery}>
                      {log.photos.map((photo, pIdx) => (
                        <div 
                          key={pIdx} 
                          className={classes.thumbnailWrapper}
                          onClick={() => setFullscreenPhoto(photo.photo_url)}
                        >
                          <img src={photo.photo_url} alt="Stage inspection" className={classes.thumbnail} />
                          <div className={classes.thumbnailHover}><FiImage /></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {sortedLogs.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>
              No history found for this asset.
            </div>
          )}
        </div>
      </div>

      {fullscreenPhoto && (
        <div className={classes.fullscreenOverlay} onClick={() => setFullscreenPhoto(null)}>
          <img src={fullscreenPhoto} alt="Fullscreen View" className={classes.fullscreenImage} />
          <button className={classes.fullscreenClose} onClick={() => setFullscreenPhoto(null)}>
            <FiX size={24} />
          </button>
        </div>
      )}
    </>
  );
}
