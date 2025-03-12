// media-info.component.ts
import { Component, Input, Output, EventEmitter, AfterViewInit, ElementRef, ViewChild } from '@angular/core';

interface Media {
  name: string;
  type: string;
  duration?: string;
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

  private generateVideoThumbnail() {
    const video = this.videoElement.nativeElement;
    video.currentTime = 1; // Aller à la 1ère seconde

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