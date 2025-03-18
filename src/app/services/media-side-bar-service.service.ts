// media-sidebar.service.ts
import { Injectable } from '@angular/core';
import { Media } from '../models/Media';


@Injectable({
  providedIn: 'root'
})
export class MediaSidebarService {
  constructor() { }

  async processFile(file: File): Promise<Media> {
    if (file.type.startsWith('video')) {
      return this.processVideo(file);
    } else if (file.type.startsWith('image')) {
      return this.processImage(file);
    }
    throw new Error('Unsupported media type');
  }

  private async processVideo(file: File): Promise<Media> {
    const newMedia: Media = {
      name: file.name,
      type: file.type,
      source: URL.createObjectURL(file),
      thumbnail: URL.createObjectURL(file)
    };

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = newMedia.source ?? "";

    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => {
        newMedia.originalDuration = video.duration;
        newMedia.duration = video.duration;
        newMedia.startTime = 0;
        newMedia.endTime = newMedia.duration;

        video.currentTime = 1;
        video.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            newMedia.thumbnail = canvas.toDataURL('image/jpeg');
          }
          URL.revokeObjectURL(video.src);
          resolve();
        };
      };
    });

    return newMedia;
  }

  private processImage(file: File): Media {
    return {
      name: file.name,
      type: file.type,
      thumbnail: URL.createObjectURL(file),
      duration: 5,
      startTime: 0,
      endTime: 5
    };
  }

  updateMediaTimes(mediaItems: Media[]): Media[] {
    let currentTime = 0;
    for (const media of mediaItems) {
      media.startTime = currentTime;
      media.endTime = currentTime + (media.duration || 0);
      currentTime = media.endTime;
    }
    return mediaItems;
  }

  reorderMediaItems(mediaItems: Media[], previousIndex: number, currentIndex: number): Media[] {
    const reorderedItems = [...mediaItems];
    const [movedItem] = reorderedItems.splice(previousIndex, 1);
    reorderedItems.splice(currentIndex, 0, movedItem);
    return this.updateMediaTimes(reorderedItems);
  }
}