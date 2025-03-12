interface Media {
    name: string;
    type: string;
    duration?: number; // In seconds, editable for images, based on video length for videos
    startTime?: number; // In seconds
    endTime?: number; // In seconds
    thumbnail?: string;
  }