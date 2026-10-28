import React from 'react'
import Row from '../Row/Row'
import requests from '../../../utils/requests'

const Rowlist = ({ onSelectMovie }) => {
  return (
    <>
      <Row
        title="NETFLIX ORIGINALS"
        fetchUrl={requests.fetchNetflixOriginals}
        isLargeRow={true}
        onSelectMovie={onSelectMovie}
      />
      <Row
        title="Trending Now"
        fetchUrl={requests.fetchTrending}
        onSelectMovie={onSelectMovie}
      />
      <Row
        title="Top Rated"
        fetchUrl={requests.fetchTopRatedMovies}
        onSelectMovie={onSelectMovie}
      />
      <Row
        title="Action Movies"
        fetchUrl={requests.fetchActionMovies}
        onSelectMovie={onSelectMovie}
      />
      <Row
        title="Comedy Movies"
        fetchUrl={requests.fetchComedyMovies}
        onSelectMovie={onSelectMovie}
      />
      <Row
        title="Horror Movies"
        fetchUrl={requests.fetchHorrorMovies}
        onSelectMovie={onSelectMovie}
      />
      <Row
        title="Romance Movies"
        fetchUrl={requests.fetchRomanceMovies}
        onSelectMovie={onSelectMovie}
      />
      <Row
        title="Tv Shows"
        fetchUrl={requests.fetchTvShow}
        onSelectMovie={onSelectMovie}
      />
      <Row
        title="Documentaries"
        fetchUrl={requests.fetchDocumentaries}
        onSelectMovie={onSelectMovie}
      />
    </>
  );
};

export default Rowlist;