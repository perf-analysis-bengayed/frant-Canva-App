import { Component, Input, AfterViewInit, ElementRef, ViewChild } from '@angular/core';

interface Media {
  name: string;
  type: string;
  duration?: number;
  startTime?: number;
  endTime?: number;
  thumbnail?: string;
}

@Component({
  selector: 'app-media-viewer',
  templateUrl: './media-viewer.component.html',
  styleUrls: ['./media-viewer.component.css']
})
export class MediaViewerComponent implements AfterViewInit {
  @Input() mediaItems: Media[] = [];
  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;

  currentMediaIndex = 0;
  totalDuration = 0;

  ngAfterViewInit() {
    this.calculateTotalDuration();
    this.setupVideoSequence();
  }

  private calculateTotalDuration() {
    this.totalDuration = this.mediaItems.reduce((sum, media) => sum + (media.duration || 0), 0);
  }

  private setupVideoSequence() {
    if (this.videoPlayer && this.mediaItems.length > 0) {
      const video = this.videoPlayer.nativeElement;

      video.ontimeupdate = () => {
        const currentTime = video.currentTime;
        const currentMedia = this.getCurrentMedia(currentTime);

        if (currentMedia && currentTime >= (currentMedia.endTime || 0)) {
          this.currentMediaIndex++;
          if (this.currentMediaIndex < this.mediaItems.length) {
            this.playNextMedia();
          } else {
            video.pause();
          }
        }
      };

      this.playNextMedia();
    }
  }

  private getCurrentMedia(currentTime: number): Media | null {
    return this.mediaItems.find(media => 
      currentTime >= (media.startTime || 0) && currentTime < (media.endTime || 0)
    ) || null;
  }

  private playNextMedia() {
    const video = this.videoPlayer.nativeElement;
    const nextMedia = this.mediaItems[this.currentMediaIndex];

    if (nextMedia) {
      if (nextMedia.type.startsWith('video')) {
        video.src = `assets/${nextMedia.name}`;
        video.currentTime = 0;
        video.play();
      } else if (nextMedia.type.startsWith('image')) {
        setTimeout(() => {
          this.currentMediaIndex++;
          this.playNextMedia();
        }, (nextMedia.duration || 5) * 1000);
      }
    }
  }
}