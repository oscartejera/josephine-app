
-- Create reviews table for customer feedback management
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('google', 'tripadvisor', 'yelp', 'facebook', 'ubereats', 'deliveroo', 'glovo')),
  external_id TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  author_name TEXT NOT NULL,
  author_avatar_url TEXT,
  review_text TEXT,
  review_date TIMESTAMP WITH TIME ZONE NOT NULL,
  language TEXT DEFAULT 'es',
  
  -- Response handling
  response_text TEXT,
  response_date TIMESTAMP WITH TIME ZONE,
  response_status TEXT DEFAULT 'pending' CHECK (response_status IN ('pending', 'draft', 'published', 'skipped')),
  
  -- AI-generated draft
  ai_draft TEXT,
  ai_tone TEXT CHECK (ai_tone IN ('friendly', 'professional', 'concise')),
  
  -- Metadata
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  tags TEXT[],
  is_verified BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view reviews for their group locations"
ON public.reviews FOR SELECT
USING (
  location_id IN (SELECT public.get_accessible_location_ids())
);

CREATE POLICY "Users can update reviews for their group locations"
ON public.reviews FOR UPDATE
USING (
  location_id IN (SELECT public.get_accessible_location_ids())
);

CREATE POLICY "Users can insert reviews for their group locations"
ON public.reviews FOR INSERT
WITH CHECK (
  location_id IN (SELECT public.get_accessible_location_ids())
);

-- Create indexes for common queries
CREATE INDEX idx_reviews_location_date ON public.reviews(location_id, review_date DESC);
CREATE INDEX idx_reviews_platform ON public.reviews(platform);
CREATE INDEX idx_reviews_rating ON public.reviews(rating);
CREATE INDEX idx_reviews_status ON public.reviews(response_status);

-- Create trigger for updated_at
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- Enable realtime for reviews
ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
