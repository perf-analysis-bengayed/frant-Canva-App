import { Component, Input, Output, EventEmitter, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { Media } from '../../models/Media';

@Component({
  selector: 'app-media-info',
  templateUrl: './media-info.component.html',
  styleUrls: ['./media-info.component.css']
})
export class MediaInfoComponent implements AfterViewInit {
  @Input() media!: Media;
  @Output() dragStart = new EventEmitter<Media>();
  @Output() durationChange = new EventEmitter<void>();
  @Output() timeChange = new EventEmitter<void>();
  @Output() trimVideo = new EventEmitter<{ startTime: number; duration: number }>();
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;

  maxVideoDuration: number = 0; // Initialisé à 0, sera mis à jour dynamiquement

  ngAfterViewInit() {
    if (this.media.type.startsWith('video')) {
      const video = this.videoElement.nativeElement;
      video.onloadedmetadata = () => {
        this.maxVideoDuration = video.duration; // Récupère la durée réelle de la vidéo
        this.media.originalDuration = video.duration; // Stocke la durée originale si besoin
        this.checkVideoDuration();
        if (!this.media.thumbnail) {
          this.generateVideoThumbnail();
        }
      };
    }
  }

  onDragStart(event: DragEvent) {
    event.dataTransfer?.setData('text/plain', JSON.stringify(this.media));
    this.dragStart.emit(this.media);
  }

  onDurationChange() {
    if (this.media.type.startsWith('video')) {
      const maxDuration = this.media.originalDuration || this.maxVideoDuration;
      if (this.media.duration !== undefined) {
        this.media.duration = Math.min(Math.max(1, this.media.duration), maxDuration);
      }
    } else if (this.media.type.startsWith('image')) {
      if (this.media.duration !== undefined) {
        this.media.duration = Math.max(5, this.media.duration);
      }
    }
    this.updateEndTime();
    this.durationChange.emit();
  }

  onTimeChange() {
    this.timeChange.emit();
  }

  checkVideoDuration() {
    if (this.media.duration && this.media.duration > this.maxVideoDuration) {
      this.media.duration = this.maxVideoDuration;
      this.media.endTime = (this.media.startTime || 0) + this.maxVideoDuration;
      this.trimVideo.emit({
        startTime: this.media.startTime || 0,
        duration: this.maxVideoDuration
      });
    }
  }

  trimVideoManually(startTime: number, duration: number) {
    if (duration > this.maxVideoDuration) {
      duration = this.maxVideoDuration;
    }
    this.media.startTime = startTime;
    this.media.duration = duration;
    this.media.endTime = startTime + duration;
    this.trimVideo.emit({ startTime, duration });
    this.durationChange.emit();
  }

  private updateEndTime() {
    if (this.media.startTime !== undefined && this.media.duration !== undefined) {
      this.media.endTime = this.media.startTime + this.media.duration;
    }
  }

  private generateVideoThumbnail() {
    const video = this.videoElement.nativeElement;
    video.currentTime = 1;

    video.onloadeddata = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        this.media.thumbnail = canvas.toDataURL('image/jpeg');
      }
    };
  }

  getFileNameWithoutExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.');
    const name = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
    return name.length > 10 ? name.substring(0, 10) + '...' : name;
  }

  getFileExtension(type: string): string {
    if (type.startsWith('image')) {
      return 'image';
    } else if (type.startsWith('video')) {
      return 'vidéo';
    }
    return 'inconnu';
  }
}