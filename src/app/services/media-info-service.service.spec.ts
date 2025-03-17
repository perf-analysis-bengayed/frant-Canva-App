import { TestBed } from '@angular/core/testing';

import { MediaInfoServiceService } from './media-info-service.service';

describe('MediaInfoServiceService', () => {
  let service: MediaInfoServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MediaInfoServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
