import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MediaService {
  adjustDuration(media: Media) {
    throw new Error('Method not implemented.');
  }
  updateEndTime(media: Media) {
    throw new Error('Method not implemented.');
  }
  checkVideoDuration(media: Media) {
    throw new Error('Method not implemented.');
  }
  trimVideoManually(media: Media, startTime: number, duration: number) {
    throw new Error('Method not implemented.');
  }
  generateVideoThumbnail(video: HTMLVideoElement): string | PromiseLike<string> {
    throw new Error('Method not implemented.');
  }
  getFileNameWithoutExtension(fileName: string): string {
    throw new Error('Method not implemented.');
  }
  getFileExtension(type: string): string {
    throw new Error('Method not implemented.');
  }

  constructor() { }
}
