import { Component, Input, Output, EventEmitter, AfterViewInit, ElementRef, ViewChild } from '@angular/core';

interface Media {
  name: string;
  type: string;
  duration?: number;
  startTime?: number;
  endTime?: number;
  thumbnail?: string;
}

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
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;

  ngAfterViewInit() {
    if (this.media.type.startsWith('video') && !this.media.thumbnail) {
      this.generateVideoThumbnail();
    }
  }

  onDragStart(event: DragEvent) {
    event.dataTransfer?.setData('text/plain', JSON.stringify(this.media));
    this.dragStart.emit(this.media);
  }

  onDurationChange() {
    if (this.media.type.startsWith('image')) {
      // Assurer une durée minimale de 5 secondes pour les images
      if (this.media.duration && this.media.duration < 5) {
        this.media.duration = 5;
      }
      if (this.media.startTime !== undefined) {
        this.media.endTime = this.media.startTime + (this.media.duration || 5);
      }
      this.durationChange.emit();
    }
    // Pas d'action pour les vidéos car la durée est fixe
  }

  onTimeChange() {
    this.timeChange.emit();
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
}