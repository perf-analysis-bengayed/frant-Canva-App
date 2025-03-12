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
  @Output() timeChange = new EventEmitter<void>(); // Ajout pour gérer les changements de temps
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
    if (this.media.type.startsWith('image') && this.media.duration && this.media.startTime !== undefined) {
      this.media.endTime = this.media.startTime + this.media.duration;
    }
    this.durationChange.emit();
  }

  onTimeChange() {
    this.timeChange.emit(); // Émet un événement pour recalculer les temps si nécessaire
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